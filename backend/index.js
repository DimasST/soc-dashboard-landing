import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import slaLogsRoutes from "./api/sla-logs/route.js";
import axios from "axios";
import bodyParser from "body-parser";
import "dotenv/config";

dotenv.config();

const app = express();
const PORT = 3001;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());

// ==================== EMAIL HELPER ====================
async function sendEmail({ to, subject, html }) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.sendMail({
      from: `"SOC Dashboard" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`📩 Email sent to ${to}`);
  } catch (err) {
    console.error(`❌ Failed to send email to ${to}:`, err);
    throw err;
  }
}


// ====== KONFIGURASI PRTG ======
const PRTG_HOST = process.env.PRTG_HOST; // contoh: http://127.0.0.1
const PRTG_USERNAME = process.env.PRTG_USERNAME;
const PRTG_PASSHASH = process.env.PRTG_PASSHASH;

/* ==================== DEVICE CRUD & GROUP ==================== */

// Add device
app.post("/api/devices", async (req, res) => {
  const { name, host, parentId } = req.body;
  if (!name || !host || !parentId) {
    return res.status(400).json({ error: "Name, Host, dan Parent Group ID wajib diisi" });
  }
  try {
    const url = `${PRTG_HOST}/api/adddevice.htm`;
    const params = {
      name: name.trim(),
      host: host.trim(),
      id: parentId.trim(),
      username: PRTG_USERNAME,
      passhash: PRTG_PASSHASH,
    };
    const response = await axios.get(url, { params });
    if (response.data.includes("<error>")) {
      return res.status(400).json({ error: response.data });
    }
    res.json({ success: true, result: response.data });
  } catch (error) {
    console.error("Error adding device:", error.message);
    res.status(500).json({ error: "Failed to add device: " + error.message });
  }
});

// Get devices
app.get("/api/devices", async (req, res) => {
  try {
    const url = `${PRTG_HOST}/api/table.json`;
    const params = {
      content: "devices",
      columns: "objid,device,host,group,probe,status",
      username: PRTG_USERNAME,
      passhash: PRTG_PASSHASH,
    };
    const response = await axios.get(url, { params });
    res.json(response.data.devices || []);
  } catch (error) {
    console.error("Error fetching devices:", error.message);
    res.status(500).json({ error: "Failed to fetch devices" });
  }
});

// Update device
app.put("/api/devices/:id", async (req, res) => {
  const { id } = req.params;
  const { newName } = req.body;
  if (!newName) return res.status(400).json({ error: "New name is required" });
  try {
    const url = `${PRTG_HOST}/api/setobjectproperty.htm`;
    const params = {
      id,
      name: "name",
      value: newName.trim(),
      username: PRTG_USERNAME,
      passhash: PRTG_PASSHASH,
    };
    const response = await axios.get(url, { params });
    res.json({ success: true, result: response.data });
  } catch (error) {
    console.error("Error updating device:", error.message);
    res.status(500).json({ error: "Failed to update device" });
  }
});

// Delete device
app.delete("/api/devices/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const url = `${PRTG_HOST}/api/deleteobject.htm`;
    const params = {
      id,
      approve: 1,
      username: PRTG_USERNAME,
      passhash: PRTG_PASSHASH,
    };
    const response = await axios.get(url, { params });
    res.json({ success: true, result: response.data });
  } catch (error) {
    console.error("Error deleting device:", error.message);
    res.status(500).json({ error: "Failed to delete device" });
  }
});

// Get groups
app.get("/api/groups", async (req, res) => {
  try {
    const url = `${PRTG_HOST}/api/table.json`;
    const params = {
      content: "groups",
      columns: "objid,group,probe",
      username: PRTG_USERNAME,
      passhash: PRTG_PASSHASH,
    };
    const response = await axios.get(url, { params });
    res.json(response.data);
  } catch (error) {
    console.error("Error fetching groups:", error.message);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

/* ==================== LOGIN ==================== */
app.post("/login", async (req, res) => {
  const { username, password, userAgent } = req.body;
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) return res.status(401).json({ error: "User not found" });
    if (!user.password) {
      return res.status(401).json({ error: "User has no password set" });
    }
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) return res.status(401).json({ error: "Invalid credentials" });

    await prisma.UserLog.create({
      data: {
        userId: user.id,
        username: user.username || "",
        action: "login",
        ip: req.ip || "",
        userAgent: userAgent || req.headers["user-agent"] || "",
      },
    });

    res.json({
      id: user.id,
      name: user.username,
      email: user.email ?? "",
      role: user.role,
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ==================== LOGOUT ==================== */
app.post("/logout", async (req, res) => {
  try {
    const { userId, username, userAgent } = req.body;
    if (!userId || !username) {
      return res.status(400).json({ error: "User ID and username are required" });
    }
    await prisma.UserLog.create({
      data: {
        userId,
        username,
        action: "logout",
        ip: req.ip || "",
        userAgent: userAgent || req.headers["user-agent"] || "",
      },
    });
    res.json({ success: true, message: "User logged out" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ==================== USERS ==================== */
app.get("/api/user", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        isActivated: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    res.json(users);
  } catch (error) {
    console.error("Error getting users:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/api/user/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.user.delete({ where: { id } });
    res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

/* ==================== INVITATION ==================== */
app.post("/api/invitation", async (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) return res.status(400).json({ error: "Email and role are required" });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(400).json({ error: "Email already invited" });

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await prisma.user.create({
      data: { email, role, isActivated: false, activationToken: token },
    });

    const activationLink = `http://localhost:3000/activate`;
    await sendEmail({
      to: email,
      subject: "You're Invited to SOC Dashboard",
      html: `
        <p>Hello,</p>
        <p>You have been invited to SOC Dashboard as <strong>${role}</strong>.</p>
        <p>Please open the activation page at:</p>
        <p><a href="${activationLink}">${activationLink}</a></p>
        <p>And use the following token to activate your account:</p>
        <p style="font-size: 18px;"><code>${token}</code></p>
        <p>This token is valid until used.</p>
      `,
    });

    res.status(200).json({ success: true, message: "Invitation sent successfully" });
  } catch (error) {
    console.error("Invitation error:", error);
    res.status(500).json({ error: "Failed to send invitation" });
  }
});

/* ==================== ACTIVATION ==================== */
app.post("/api/activate", async (req, res) => {
  const { token, username, password, name } = req.body;
  if (!token || !username || !password || !name)
    return res.status(400).json({ error: "All fields are required" });

  try {
    const user = await prisma.user.findFirst({
      where: { activationToken: token, isActivated: false },
    });
    if (!user) return res.status(400).json({ error: "Invalid or expired token" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        username,
        name,
        password: hashedPassword,
        isActivated: true,
        activationToken: null,
      },
    });

    if (user.isTrial) {
      setTimeout(async () => {
        try {
          await prisma.user.update({
            where: { id: user.id },
            data: { isActivated: false },
          });
          console.log(`⏳ Trial expired for ${user.email}`);
        } catch (err) {
          console.error(`Error expiring trial for ${user.email}:`, err);
        }
      }, 5 * 60 * 1000);
    }
    res.json({ success: true });
  } catch (error) {
    console.error("Activation error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

/* ==================== SENSOR DATA ==================== */
app.get("/api/sensors", async (req, res) => {
  try {
    const sensors = await prisma.sensors.findMany();
    res.json(sensors);
  } catch (error) {
    console.error("Error fetching sensors:", error);
    res.status(500).json({ error: "Failed to fetch sensors" });
  }
});

app.get("/api/sensor_logs", async (req, res) => {
  try {
    const logs = await prisma.sensor_logs.findMany();
    res.json(logs);
  } catch (error) {
    console.error("Error fetching sensor logs:", error);
    res.status(500).json({ error: "Failed to fetch sensor logs" });
  }
});

/* ==================== USER LOGS ==================== */
app.get("/api/user-logs", async (req, res) => {
  try {
    const logs = await prisma.UserLog.findMany({
      orderBy: { createdAt: "desc" },
    });
    res.json(logs);
  } catch (error) {
    console.error("Error fetching user logs:", error);
    res.status(500).json({ error: "Failed to fetch user logs" });
  }
});

/* ==================== SLA LOGS ==================== */
app.use("/api/sla-logs", slaLogsRoutes);

/* ==================== FREE TRIAL ==================== */
app.post("/api/free-trial", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: "Email is required" });

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already exists" });
    }
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await prisma.user.create({
      data: {
        email,
        role: "admin",
        isActivated: false,
        activationToken: token,
        isTrial: true,
      },
    });

    const activationLink = `http://localhost:3000/activate?token=${token}`;
    await sendEmail({
      to: email,
      subject: "🎯 Free Trial Invitation - 5 Minutes",
      html: `
        <h2>Selamat! Anda mendapatkan trial 5 menit.</h2>
        <p>Klik link berikut untuk mengaktifkan akun Anda:</p>
        <p><a href="${activationLink}">${activationLink}</a></p>
        <p><b>Catatan:</b> Trial akan dimulai saat Anda aktivasi akun dan berakhir otomatis 5 menit kemudian.</p>
        <p>Token Aktivasi: <b>${token}</b></p>
      `,
    });

    res.json({ success: true, message: "Trial invitation sent" });
  } catch (error) {
    console.error("Free trial error:", error);
    res.status(500).json({ error: "Failed to create trial invitation" });
  }
});

/* ==================== DUMMY PAYMENT + INVITATION ==================== */
app.post("/api/payment", async (req, res) => {
  const { email, role } = req.body;
  if (!email || !role) {
    return res.status(400).json({ error: "Email and role are required" });
  }

  try {
    console.log(`💳 Processing payment for ${email}...`);
    // Simulasi pembayaran sukses
    const paymentSuccess = true;

    if (!paymentSuccess) {
      return res.status(400).json({ error: "Payment failed" });
    }

    console.log(`✅ Payment successful for ${email}`);

    // Lanjut buat invitation
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ error: "Email already registered" });
    }

    const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
    await prisma.user.create({
      data: {
        email,
        role,
        isActivated: false,
        activationToken: token,
        isTrial: false, // karena ini pembayaran beneran
      },
    });

    const activationLink = `http://localhost:3000/activate`;
    await sendEmail({
      to: email,
      subject: "Payment Success - Activate Your SOC Dashboard Account",
      html: `
        <h2>Thank you for your payment!</h2>
        <p>Your account is almost ready. Please activate it using the token below:</p>
        <p><a href="${activationLink}">${activationLink}</a></p>
        <p><b>Activation Token:</b> ${token}</p>
      `,
    });

    res.json({ success: true, message: "Payment successful, invitation sent" });
  } catch (error) {
    console.error("Payment error:", error);
    res.status(500).json({ error: "Payment processing failed" });
  }
});

/* ==================== START SERVER ==================== */
app.listen(PORT, () => {
  console.log(`✅ Server backend berjalan di http://localhost:${PORT}`);
});

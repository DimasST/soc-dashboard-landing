// components/AddDevice.tsx
'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';

export default function AddDeviceForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [parentId, setParentId] = useState(''); // ID group PRTG

  const [groups, setGroups] = useState([]);

  useEffect(() => {
    async function fetchGroups() {
      try {
        const res = await axios.get('http://localhost:3001/api/groups');
        const data = res.data;
  
        let groupList = [];
        if (Array.isArray(data.groups)) {
          groupList = data.groups;
        } else if (data?.tree?.nodes) {
          groupList = data.tree.nodes;
        }
  
        setGroups(groupList);
        if (groupList.length > 0) setParentId(groupList[0].objid); // default
      } catch (err) {
        console.error('Error fetching groups:', err);
      }
    }
    fetchGroups();
  }, []);
  

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !host || !parentId) {
      alert('Name, Host, dan Parent Group wajib diisi!');
      return;
    }
    onSubmit(name, host, parentId);
  };

  return (
    <div className="bg-[#1e293b] p-6 rounded-lg w-96">
      <h3 className="text-lg font-semibold mb-4">Add Device</h3>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input type="text" placeholder="Device Name" value={name} onChange={e => setName(e.target.value)}
          className="px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white" />
        <input type="text" placeholder="Host (IP/DNS)" value={host} onChange={e => setHost(e.target.value)}
          className="px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white" />
        <select value={parentId} onChange={e => setParentId(e.target.value)}
          className="px-3 py-2 rounded bg-gray-800 border border-gray-600 text-white">
          {groups.map(g => <option key={g.objid} value={g.objid}>{g.group}</option>)}
        </select>
        <div className="flex justify-end gap-2 mt-2">
          <button type="button" onClick={onCancel} className="bg-gray-500 hover:bg-gray-600 px-4 py-1 rounded">Cancel</button>
          <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-4 py-1 rounded">Add</button>
        </div>
      </form>
    </div>
  );
}

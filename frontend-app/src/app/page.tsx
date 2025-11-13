'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react';
import { useQuery, useMutation, gql, useSubscription } from '@apollo/client';
import { authApi } from '@/lib/api';

// 1. Update Query untuk mengambil 'creatorId'
const GET_TASKS = gql`
  query GetTasks($teamId: ID!) {
    tasks(teamId: $teamId) {
      id
      title
      status
      creatorId  # <-- PENTING: Kita butuh ini untuk cek kepemilikan
      createdAt
    }
  }
`;

const CREATE_TASK = gql`
  mutation CreateTask($teamId: ID!, $title: String!, $description: String) {
    createTask(teamId: $teamId, title: $title, description: $description) {
      id
    }
  }
`;

// 2. Tambahkan Mutation Delete
const DELETE_TASK = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id)
  }
`;

const TASK_ADDED_SUB = gql`
  subscription TaskAdded($teamId: ID!) {
    taskAdded(teamId: $teamId) {
      id
      title
      status
      creatorId
    }
  }
`;

const DEMO_TEAM_ID = 'team1';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  // State untuk menyimpan data user yang sedang login
  const [currentUser, setCurrentUser] = useState<{ id: string, name: string, role: string } | null>(null);
  
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [error, setError] = useState('');

  // Load token & user dari localStorage saat awal
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken) setToken(storedToken);
    if (storedUser) setCurrentUser(JSON.parse(storedUser));
  }, []);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user'); // Hapus user juga
    setToken(null);
    setCurrentUser(null);
    setError('');
  }, []);

  // --- GRAPHQL ---
  const { data: tasksData, loading: tasksLoading, refetch: refetchTasks, error: queryError } = useQuery(GET_TASKS, {
    variables: { teamId: DEMO_TEAM_ID },
    skip: !token,
  });

  useEffect(() => {
    if (queryError) {
      console.error('Query Error:', queryError);
      if (queryError.message.includes('401') || queryError.message.includes('Unauthorized')) {
        handleLogout();
      }
    }
  }, [queryError, handleLogout]);

  const [createTask] = useMutation(CREATE_TASK, {
    onCompleted: () => {
      setNewTaskTitle('');
      refetchTasks();
    },
    onError: (err) => alert(`Gagal: ${err.message}`)
  });

  // Mutation Delete
  const [deleteTask] = useMutation(DELETE_TASK, {
    onCompleted: () => refetchTasks(),
    onError: (err) => alert(`Gagal menghapus: ${err.message}`)
  });

  useSubscription(TASK_ADDED_SUB, {
    variables: { teamId: DEMO_TEAM_ID },
    skip: !token,
    onData: () => refetchTasks()
  });

  // --- HANDLERS ---
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await authApi.login({ email, password });
      const { token, user } = response.data; // Ambil user juga
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user)); // Simpan user ke storage
      
      setToken(token);
      setCurrentUser(user);
    } catch (err: any) {
      setError('Login gagal. Cek email/password.');
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await authApi.register({ name, email, password });
      alert('Registrasi sukses! Silakan login.');
      setIsLoginView(true);
    } catch (err: any) {
      setError('Registrasi gagal.');
    }
  };

  const handleCreateTask = (e: FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle) return;
    createTask({
      variables: {
        teamId: DEMO_TEAM_ID,
        title: newTaskTitle,
        description: ''
      }
    });
  };

  // Fungsi helper untuk cek apakah boleh delete
  const canDelete = (taskCreatorId: string) => {
    if (!currentUser) return false;
    // BOLEH JIKA: Role adalah 'admin' ATAU User adalah pembuat task
    return currentUser.role === 'admin' || currentUser.id === taskCreatorId;
  };

  // --- RENDER ---
  if (!token) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white shadow rounded-lg p-8 max-w-md w-full">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-6">
            {isLoginView ? 'Login' : 'Register'}
          </h2>
          {error && <p className="text-red-500 text-center mb-4">{error}</p>}
          
          <form onSubmit={isLoginView ? handleLogin : handleRegister}>
            {!isLoginView && (
              <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} className="border rounded-md px-3 py-2 mb-4 w-full" required />
            )}
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} className="border rounded-md px-3 py-2 mb-4 w-full" required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} className="border rounded-md px-3 py-2 mb-4 w-full" required />
            <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 w-full">
              {isLoginView ? 'Login' : 'Register'}
            </button>
          </form>
          <button onClick={() => { setIsLoginView(!isLoginView); setError(''); }} className="text-center text-sm text-blue-500 hover:underline w-full mt-4">
            {isLoginView ? 'Belum punya akun? Register' : 'Sudah punya akun? Login'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Daftar Tugas</h1>
            <p className="text-gray-600">Login sebagai: <span className="font-bold">{currentUser?.name}</span> ({currentUser?.role})</p>
          </div>
          <button onClick={handleLogout} className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600">Logout</button>
        </div>

        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Tugas Baru</h2>
          <form onSubmit={handleCreateTask}>
            <input type="text" placeholder="Judul task baru..." value={newTaskTitle} onChange={(e) => setNewTaskTitle(e.target.value)} className="border rounded-md px-3 py-2 w-full" required />
            <button type="submit" className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 mt-4 w-full">Tambah Tugas</button>
          </form>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Daftar Tugas</h2>
          {tasksLoading ? (
            <p>Loading tasks...</p>
          ) : (
            <div className="space-y-4">
              {tasksData?.tasks.map((task: any) => (
                <div key={task.id} className="p-4 border rounded-md flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-lg">{task.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">Status: <span className="font-medium text-blue-600">{task.status}</span></p>
                    <p className="text-xs text-gray-400 mt-1">Oleh ID: {task.creatorId}</p>
                  </div>
                  
                  {/* Tombol Delete dengan Kondisi */}
                  {canDelete(task.creatorId) && (
                    <button 
                      onClick={() => {
                        if(confirm('Yakin hapus?')) deleteTask({ variables: { id: task.id } });
                      }}
                      className="bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1 rounded text-sm"
                    >
                      Hapus
                    </button>
                  )}
                </div>
              ))}
              {tasksData?.tasks.length === 0 && <p className="text-gray-500">Belum ada tugas.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
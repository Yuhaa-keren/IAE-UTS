// frontend-app/src/app/page.tsx
'use client';

import { useState, useEffect, FormEvent, useCallback } from 'react'; // Tambah useCallback
import { useQuery, useMutation, gql, useSubscription } from '@apollo/client';
import { authApi } from '@/lib/api';

// --- DEFINISI GRAPHQL (SAMA SEPERTI SEBELUMNYA) ---
const GET_TASKS = gql`
  query GetTasks($teamId: ID!) {
    tasks(teamId: $teamId) {
      id
      title
      status
      assigneeId
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

const TASK_ADDED_SUB = gql`
  subscription TaskAdded($teamId: ID!) {
    taskAdded(teamId: $teamId) {
      id
      title
      status
    }
  }
`;

const DEMO_TEAM_ID = 'team1';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // Definisi handleLogout (Pindahkan ke atas agar bisa dipakai di useEffect)
  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setError('');
  }, []);

  // --- QUERY DENGAN PERBAIKAN ---
  // 1. Kita ambil objek 'error' dari hasil useQuery
  // 2. Kita HAPUS opsi 'onError' yang deprecated
  const { data: tasksData, loading: tasksLoading, refetch: refetchTasks, error: queryError } = useQuery(GET_TASKS, {
    variables: { teamId: DEMO_TEAM_ID },
    skip: !token, 
  });

  // 3. Kita gunakan useEffect untuk menangani error
  useEffect(() => {
    if (queryError) {
      console.error('Error fetching tasks:', queryError);
      // Jika error karena token tidak valid (401) atau network error
      if (queryError.networkError || queryError.message.includes('401')) {
        handleLogout();
      }
    }
  }, [queryError, handleLogout]);


  // --- MUTATION & SUBSCRIPTION (SAMA SEPERTI SEBELUMNYA) ---
  const [createTask] = useMutation(CREATE_TASK, {
    onCompleted: () => {
      setNewTaskTitle('');
      refetchTasks();
    },
    onError: (err) => setError(`Gagal membuat task: ${err.message}`)
  });

  useSubscription(TASK_ADDED_SUB, {
    variables: { teamId: DEMO_TEAM_ID },
    skip: !token,
    onData: ({ data }) => {
      // alert(`Task Baru: ${data.data.taskAdded.title}`); // Optional: alert ganggu kalau sering
      console.log('Task baru:', data.data.taskAdded);
      refetchTasks();
    }
  });

  // --- HANDLERS ---
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const response = await authApi.login({ email, password });
      const { token } = response.data;
      localStorage.setItem('token', token);
      setToken(token);
    } catch (err: any) {
      setError('Login gagal. Cek email/password.');
      console.error(err);
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
      setError('Registrasi gagal. Email mungkin sudah dipakai.');
      console.error(err);
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
          <h1 className="text-4xl font-bold text-gray-900">Daftar Tugas (Tim: {DEMO_TEAM_ID})</h1>
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
                <div key={task.id} className="p-4 border rounded-md">
                  <h3 className="font-semibold text-lg">{task.title}</h3>
                  <p className="text-sm text-gray-600 mt-1">Status: <span className="font-medium text-blue-600">{task.status}</span></p>
                  <p className="text-xs text-gray-400 mt-2">ID: {task.id}</p>
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
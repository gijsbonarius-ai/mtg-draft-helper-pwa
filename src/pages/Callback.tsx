import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function Callback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const accountId = searchParams.get('state'); // state param contains the account_id

    if (!code || !accountId) {
      setError('Missing required parameters. The bank connection could not be completed.');
      return;
    }

    async function exchangeCode() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('You must be logged in to connect a bank account.');
          return;
        }

        const { data, error: fnError } = await supabase.functions.invoke('truelayer-exchange', {
          body: { code, account_id: accountId, user_id: user.id },
        });

        if (fnError || !data?.success) {
          console.error('Exchange error:', fnError);
          setError('Something went wrong while connecting your bank. Please try again.');
          return;
        }

        // Success — go back to accounts with a success indicator
        navigate('/accounts?connected=1', { replace: true });
      } catch (err) {
        console.error(err);
        setError('An unexpected error occurred. Please try again.');
      }
    }

    exchangeCode();
  }, [searchParams, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center space-y-4">
          <div className="text-4xl">❌</div>
          <h1 className="text-xl font-semibold text-gray-900">Connection failed</h1>
          <p className="text-gray-500 text-sm">{error}</p>
          <a
            href="/accounts"
            className="inline-block mt-2 text-blue-600 hover:underline text-sm"
          >
            ← Go back to Accounts
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="text-gray-600 font-medium">Connecting your bank account…</p>
        <p className="text-gray-400 text-sm">This will only take a moment</p>
      </div>
    </div>
  );
}

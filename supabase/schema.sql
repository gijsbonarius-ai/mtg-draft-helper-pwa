-- Enable RLS
create table accounts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  name text not null,
  type text not null check (type in ('bank', 'investment', 'credit_card')),
  currency text not null default 'EUR',
  balance numeric(15,2) not null default 0,
  institution text,
  color text,
  created_at timestamptz default now()
);

create table transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  account_id uuid references accounts(id) on delete cascade not null,
  date date not null,
  description text not null,
  amount numeric(15,2) not null,
  category text,
  type text not null check (type in ('income', 'expense', 'transfer')),
  created_at timestamptz default now()
);

alter table accounts enable row level security;
alter table transactions enable row level security;

create policy "Users can manage own accounts" on accounts for all using (auth.uid() = user_id);
create policy "Users can manage own transactions" on transactions for all using (auth.uid() = user_id);

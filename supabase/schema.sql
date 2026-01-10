-- 1. Create 'groups' table
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for invite_code for faster lookups
CREATE INDEX idx_groups_invite_code ON groups(invite_code);

-- 2. Create 'categories' table
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE, -- NULL means system default
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    name TEXT NOT NULL,
    icon TEXT, -- Emoji or Lucide icon name
    color TEXT, -- Hex code
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create 'profiles' table (extends auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create 'transactions' table
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id),
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    amount BIGINT NOT NULL,
    description TEXT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (Row Level Security)
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Profiles: Users can only read/write their own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete own profile" ON profiles FOR DELETE USING (auth.uid() = id);

-- Groups: Users can view groups they belong to
CREATE POLICY "Users can view their group" ON groups FOR SELECT 
USING (id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

-- Categories: Users can view system defaults OR categories for their group
CREATE POLICY "Users can view categories" ON categories FOR SELECT 
USING (group_id IS NULL OR group_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert group categories" ON categories FOR INSERT 
WITH CHECK (group_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update group categories" ON categories FOR UPDATE
USING (group_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete group categories" ON categories FOR DELETE
USING (group_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

-- Transactions: Users can view/modify transactions in their group
CREATE POLICY "Users can view group transactions" ON transactions FOR SELECT 
USING (group_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert own group transactions" ON transactions FOR INSERT 
WITH CHECK (group_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can update own group transactions" ON transactions FOR UPDATE 
USING (group_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Users can delete own group transactions" ON transactions FOR DELETE 
USING (group_id IN (SELECT group_id FROM profiles WHERE id = auth.uid()));

-- 6. Initial Default Categories
INSERT INTO categories (type, name, icon, color, is_default) VALUES
('expense', '식비', '🍔', '#FF5733', true),
('expense', '교통', '🚌', '#33FF57', true),
('expense', '쇼핑', '🛍️', '#3357FF', true),
('expense', '주거/통신', '🏠', '#FF33A1', true),
('expense', '의료/건강', '💊', '#33FFF5', true),
('income', '급여', '💰', '#FFBD33', true),
('income', '용돈', '💵', '#75FF33', true),
('income', '금융수입', '📈', '#DB33FF', true),
('income', '기타', '🎸', '#808080', true);

-- 7. Automated Profile Creation (Trigger)
-- Function to insert a row into public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to call the function on new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
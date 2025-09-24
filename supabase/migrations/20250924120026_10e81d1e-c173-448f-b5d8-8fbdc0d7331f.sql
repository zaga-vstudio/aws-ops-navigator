-- Crear tabla user_aws_credentials si no existe
CREATE TABLE IF NOT EXISTS user_aws_credentials (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    access_key_id TEXT NOT NULL,
    secret_access_key TEXT NOT NULL,
    region TEXT DEFAULT 'us-east-1',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Habilitar RLS
ALTER TABLE user_aws_credentials ENABLE ROW LEVEL SECURITY;

-- Crear políticas de seguridad
CREATE POLICY "Users can manage own AWS credentials" ON user_aws_credentials
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AWS credentials" ON user_aws_credentials
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own AWS credentials" ON user_aws_credentials
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can read own AWS credentials" ON user_aws_credentials
    FOR SELECT USING (auth.uid() = user_id);

-- Crear índices para optimización
CREATE INDEX IF NOT EXISTS idx_user_aws_credentials_user_id 
ON user_aws_credentials(user_id);

CREATE INDEX IF NOT EXISTS idx_user_aws_credentials_active 
ON user_aws_credentials(user_id, is_active) 
WHERE is_active = true;

-- Actualizar user_setup para asegurar que tiene onboarding_completed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_setup' 
        AND column_name = 'onboarding_completed'
    ) THEN
        ALTER TABLE user_setup ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Crear triggers para updated_at (verificar si ya existe la función)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $func$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $func$ language 'plpgsql';
    END IF;
END $$;

-- Crear trigger para user_aws_credentials si no existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.triggers 
        WHERE trigger_name = 'update_user_aws_credentials_updated_at'
    ) THEN
        CREATE TRIGGER update_user_aws_credentials_updated_at 
            BEFORE UPDATE ON user_aws_credentials 
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
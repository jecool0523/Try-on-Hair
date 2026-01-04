import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ixbxgrdvwtzdakniuwnd.supabase.co';
const supabaseKey = 'sb_publishable_HKX3NLVai3I5H-Ugu5quuQ_CMtWvXRk';

export const supabase = createClient(supabaseUrl, supabaseKey);
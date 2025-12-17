import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xbvpywqcndedifhhxciy.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhidnB5d3FjbmRlZGlmaGh4Y2l5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzE5NzI0MjcsImV4cCI6MjA0NzU0ODQyN30.tABvYa7HZEKfnB5uxWqZJ_PGUeZ2wG0rrVQVCf9SGqE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

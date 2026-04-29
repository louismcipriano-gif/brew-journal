import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  'https://quiwcyuhewafemeinqcd.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1aXdjeXVoZXdhZmVtZWlucWNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MDMzNTUsImV4cCI6MjA5Mjk3OTM1NX0.-egbL-WvmVYzeJ-N0CKgKxcsfbO5wo6hEFFZV4_tmpY',
);

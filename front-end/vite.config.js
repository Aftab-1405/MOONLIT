import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Auth endpoints
      '/firebase-config': 'http://localhost:5000',
      '/set_session': 'http://localhost:5000',
      '/check_session': 'http://localhost:5000',
      '/logout': 'http://localhost:5000',
      
      // Chat/AI endpoints
      '/pass_userinput_to_gemini': 'http://localhost:5000',
      '/get_conversations': 'http://localhost:5000',
      '/get_conversation': 'http://localhost:5000',
      '/new_conversation': 'http://localhost:5000',
      '/delete_conversation': 'http://localhost:5000',
      
      // Database endpoints
      '/connect_db': 'http://localhost:5000',
      '/disconnect_db': 'http://localhost:5000',
      '/get_databases': 'http://localhost:5000',
      '/get_tables': 'http://localhost:5000',
      '/get_table_schema': 'http://localhost:5000',
      '/run_sql_query': 'http://localhost:5000',
      '/query-result': 'http://localhost:5000',
      '/db_status': 'http://localhost:5000',
      '/db_heartbeat': 'http://localhost:5000',
      '/switch_remote_database': 'http://localhost:5000',
      '/get_schemas': 'http://localhost:5000',
      '/select_schema': 'http://localhost:5000',
      
      // User settings
      '/api/user/settings': 'http://localhost:5000',
    },
  },
})

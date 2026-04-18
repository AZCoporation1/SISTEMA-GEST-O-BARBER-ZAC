import fetch from 'node-fetch';
import * as fs from 'fs';

const projectId = 'gyausvxjrpkheennijiv';
const token = 'sbp_b55d0f8abaf65686c943b6014d92d42c37a73e59';
const sqlPath = process.argv[2];

if (!sqlPath) {
  console.error('Providencie o caminho para o arquivo SQL.');
  process.exit(1);
}

const sqlContent = fs.readFileSync(sqlPath, 'utf8');

async function run() {
  const url = `https://api.supabase.com/v1/projects/${projectId}/database/query`
  
  console.log(`Enviando script SQL para ${url}...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: sqlContent })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Erro na API (${response.status}):`, errorText);
      process.exit(1);
    }

    const data = await response.json();
    console.log('Sucesso! Resposta:');
    console.log(data);
  } catch (err) {
    console.error('Exceção ao chamar API:', err);
  }
}

run();

export type Operational5sStage = 'ABERTURA' | 'DURANTE_O_DIA' | 'FECHAMENTO';
export type Operational5sStatus = 'PENDING' | 'CONFORME' | 'NAO_CONFORME' | 'NAO_SE_APLICA';

export interface Operational5sItemTemplate {
  id: string;
  stage: Operational5sStage;
  label: string;
  description?: string;
}

export const official5sTemplate: Operational5sItemTemplate[] = [
  // ABERTURA
  { id: 'ab-1', stage: 'ABERTURA', label: 'Bancadas, cadeiras e espelhos limpos e organizados' },
  { id: 'ab-2', stage: 'ABERTURA', label: 'Máquinas carregadas e ferramentas higienizadas' },
  { id: 'ab-3', stage: 'ABERTURA', label: 'Toalhas limpas disponíveis e usadas separadas' },
  { id: 'ab-4', stage: 'ABERTURA', label: 'Produtos organizados, limpos e dentro da validade' },
  { id: 'ab-5', stage: 'ABERTURA', label: 'Recepção, agenda e máquina de cartão organizadas' },
  { id: 'ab-6', stage: 'ABERTURA', label: 'Banheiro e copa limpos, abastecidos e sem lixo acumulado' },
  { id: 'ab-7', stage: 'ABERTURA', label: 'Música, iluminação, aroma e temperatura ajustados' },

  // DURANTE O DIA
  { id: 'dd-1', stage: 'DURANTE_O_DIA', label: 'Após cada cliente: cadeira, chão, espelho e bancada limpos' },
  { id: 'dd-2', stage: 'DURANTE_O_DIA', label: 'Máquinas, pentes e escovas higienizados após o uso' },
  { id: 'dd-3', stage: 'DURANTE_O_DIA', label: 'Capas, toalhas e lâminas usadas separadas corretamente' },
  { id: 'dd-4', stage: 'DURANTE_O_DIA', label: 'Bancada sem lixo, copos, papéis, fios ou objetos pessoais' },
  { id: 'dd-5', stage: 'DURANTE_O_DIA', label: 'Produtos devolvidos ao local correto após o uso' },
  { id: 'dd-6', stage: 'DURANTE_O_DIA', label: 'Recepção, banheiro, chão e lixeiras conferidos' },
  { id: 'dd-7', stage: 'DURANTE_O_DIA', label: 'Equipe com higiene, postura e apresentação profissional' },

  // FECHAMENTO
  { id: 'fc-1', stage: 'FECHAMENTO', label: 'Cadeiras, bancadas, carrinhos, espelhos e chão limpos' },
  { id: 'fc-2', stage: 'FECHAMENTO', label: 'Máquinas limpas e colocadas para carregar' },
  { id: 'fc-3', stage: 'FECHAMENTO', label: 'Ferramentas higienizadas e guardadas no local correto' },
  { id: 'fc-4', stage: 'FECHAMENTO', label: 'Toalhas separadas para lavagem e lixo retirado' },
  { id: 'fc-5', stage: 'FECHAMENTO', label: 'Recepção, copa e banheiro organizados para o próximo dia' },
  { id: 'fc-6', stage: 'FECHAMENTO', label: 'Produtos baixos, vencidos, danificados ou faltantes sinalizados' },
  { id: 'fc-7', stage: 'FECHAMENTO', label: 'Equipamentos desligados, portas verificadas e ambiente seguro' },
];

export const getTemplateItemsByStage = (stage: Operational5sStage) => {
  return official5sTemplate.filter((item) => item.stage === stage);
};

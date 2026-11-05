/**
 * Dados fictícios de desenvolvimento — porta de pets-post/seeds.py.
 * Chaves naturais usadas para idempotência: users.email, *.title, partners.name.
 *
 * Os posts referenciam o dono por `ownerEmail` (resolvido no seed).
 * Os anúncios de adoção NÃO existiam no seeds.py do Flask: foram adicionados
 * para a Etapa 6 ter dados de exemplo.
 */

export const DEV_ADMIN = Object.freeze({ email: 'admin@petpost.com', password: 'Admin@123' });

export const users = [
  { name: 'Admin PetPost', email: DEV_ADMIN.email, password: DEV_ADMIN.password, role: 'admin', phone: '(11) 91234-5678' },
  { name: 'Maria Silva', email: 'maria@exemplo.com', password: 'Senha@123', phone: '(11) 98765-4321' },
  { name: 'Carlos Santos', email: 'carlos@exemplo.com', password: 'Senha@123', phone: '(21) 99111-2222' },
  { name: 'Ana Ferreira', email: 'ana@exemplo.com', password: 'Senha@123', phone: '(31) 97654-3210' },
];

export const petPosts = [
  {
    ownerEmail: 'maria@exemplo.com',
    title: 'Cachorro caramelo perdido no Parque Ibirapuera',
    description:
      'Meu cachorro fugiu durante o passeio no domingo. Ele é muito dócil e obedece quando chamado pelo nome "Rex". Tem uma mancha branca no pescoço.',
    status: 'lost',
    petName: 'Rex',
    petType: 'dog',
    petBreed: 'Vira-lata',
    petColor: 'Caramelo com mancha branca no pescoço',
    petSize: 'medium',
    lastSeenLocation: 'Parque Ibirapuera, São Paulo, SP',
    contactPhone: '(11) 98765-4321',
    contactEmail: 'maria@exemplo.com',
    reward: 'R$ 300,00 de recompensa',
  },
  {
    ownerEmail: 'maria@exemplo.com',
    title: 'Gato preto e branco encontrado no Jardim América',
    description:
      'Encontrei este gato meando muito na calçada. Parece bem cuidado, tem coleira mas sem identificação. Está guardado na minha casa.',
    status: 'found',
    petName: null,
    petType: 'cat',
    petBreed: 'SRD (vira-lata)',
    petColor: 'Preto e branco',
    petSize: 'small',
    lastSeenLocation: 'Jardim América, São Paulo, SP',
    contactPhone: '(11) 98765-4321',
    contactEmail: 'maria@exemplo.com',
  },
  {
    ownerEmail: 'carlos@exemplo.com',
    title: 'Golden Retriever perdido em Copacabana',
    description:
      'Nossa Golden Retriever fêmea se perdeu durante a caminhada da manhã. Ela usa uma coleira azul com plaquinha. É muito carinhosa com estranhos.',
    status: 'lost',
    petName: 'Mel',
    petType: 'dog',
    petBreed: 'Golden Retriever',
    petColor: 'Dourada',
    petSize: 'large',
    lastSeenLocation: 'Copacabana, Rio de Janeiro, RJ',
    contactPhone: '(21) 99111-2222',
    contactEmail: 'carlos@exemplo.com',
    reward: 'R$ 500,00 de recompensa',
  },
  {
    ownerEmail: 'ana@exemplo.com',
    title: 'Papagaio verde encontrado no bairro Savassi',
    description:
      'Um papagaio pousou na minha varanda e não foi embora. Sabe falar algumas palavras. Está bem alimentado e parece ser de estimação.',
    status: 'found',
    petName: null,
    petType: 'bird',
    petBreed: 'Papagaio',
    petColor: 'Verde com cabeça amarela',
    petSize: null,
    lastSeenLocation: 'Savassi, Belo Horizonte, MG',
    contactPhone: '(31) 97654-3210',
    contactEmail: 'ana@exemplo.com',
  },
  {
    ownerEmail: 'ana@exemplo.com',
    title: 'Gato siamês perdido no Centro de Curitiba',
    description:
      'Meu gato siamês escapou pela janela. Olhos azuis, muito assustado. Responde pelo nome "Simba". Por favor, não tente pegá-lo na força.',
    status: 'lost',
    petName: 'Simba',
    petType: 'cat',
    petBreed: 'Siamês',
    petColor: 'Bege com pontas escuras',
    petSize: 'small',
    lastSeenLocation: 'Praça Osório, Curitiba, PR',
    contactPhone: '(41) 98888-7777',
  },
];

export const adoptionPosts = [
  {
    ownerEmail: 'maria@exemplo.com',
    title: 'Filhote de vira-lata para adoção responsável',
    description: 'Filhote resgatado, muito brincalhão e saudável. Procura uma família com quintal.',
    petName: 'Pipoca',
    petType: 'dog',
    petBreed: 'Vira-lata',
    petColor: 'Preto com patas brancas',
    petSize: 'small',
    isNeutered: false,
    isVaccinated: true,
    adopterRequirements: 'Termo de adoção e compromisso de castração aos 6 meses.',
    location: 'Pinheiros, São Paulo, SP',
    contactPhone: '(11) 98765-4321',
    contactEmail: 'maria@exemplo.com',
  },
  {
    ownerEmail: 'ana@exemplo.com',
    title: 'Gata adulta castrada procura lar',
    description: 'Gata calma, acostumada com apartamento e com outros gatos.',
    petName: 'Luna',
    petType: 'cat',
    petBreed: 'SRD',
    petColor: 'Tricolor',
    petSize: 'small',
    isNeutered: true,
    isVaccinated: true,
    adopterRequirements: 'Janelas teladas.',
    location: 'Savassi, Belo Horizonte, MG',
    contactPhone: '(31) 97654-3210',
  },
];

export const partners = [
  {
    name: 'Lar Temporário da Ana',
    partnerType: 'foster_home',
    description: 'Acolhemos cães e gatos de pequeno porte por até 30 dias.',
    address: 'Pinheiros, São Paulo, SP',
    phone: '(11) 98765-1111',
    email: 'ana@exemplo.com',
  },
  {
    name: 'Casa dos Bichos',
    partnerType: 'foster_home',
    description: 'Lar temporário para pets resgatados de qualquer porte.',
    address: 'Savassi, Belo Horizonte, MG',
    phone: '(31) 97654-2222',
  },
  {
    name: 'Petshop Amigo Fiel',
    partnerType: 'petshop',
    description: 'Divulgamos pets perdidos e apoiamos a causa animal.',
    address: 'Copacabana, Rio de Janeiro, RJ',
    phone: '(21) 99111-3333',
    website: 'https://exemplo.com',
  },
  {
    name: 'PetCenter Curitiba',
    partnerType: 'petshop',
    description: 'Petshop parceiro com espaço para divulgação de adoção.',
    address: 'Praça Osório, Curitiba, PR',
    phone: '(41) 98888-4444',
  },
  {
    name: 'Clínica Vet Vida Animal',
    partnerType: 'vet_clinic',
    description: 'Atendemos pets resgatados com desconto social.',
    address: 'Parque Ibirapuera, São Paulo, SP',
    phone: '(11) 93333-5555',
    email: 'vidaanimal@exemplo.com',
  },
  {
    name: 'Hospital Veterinário Central',
    partnerType: 'vet_clinic',
    description: 'Pronto-socorro 24h para animais resgatados.',
    address: 'Jardim América, São Paulo, SP',
    phone: '(11) 91111-6666',
  },
];

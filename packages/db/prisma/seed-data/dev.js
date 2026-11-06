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

/**
 * Produtos de exemplo da loja (Etapa 7b), só nos parceiros fictícios acima. Nomes genéricos, sem
 * marca, para não parecer anúncio de loja real. Preços em centavos.
 */
export const products = [
  { partnerName: 'Petshop Amigo Fiel', name: 'Ração Premium Cães Adultos 10 kg', category: 'food', petType: 'dog', priceCents: 18990, promoPriceCents: 15990, stock: 12, isFeatured: true, description: 'Ração completa para cães adultos de porte médio, com proteína de frango e arroz.' },
  { partnerName: 'Petshop Amigo Fiel', name: 'Ração Gatos Castrados 3 kg', category: 'food', petType: 'cat', priceCents: 8990, stock: 20, description: 'Fórmula com controle de peso para gatos castrados.' },
  { partnerName: 'Petshop Amigo Fiel', name: 'Petisco Bifinho de Carne 500 g', category: 'treats', petType: 'dog', priceCents: 2490, stock: 40, description: 'Petisco macio para recompensa no adestramento.' },
  { partnerName: 'Petshop Amigo Fiel', name: 'Bolinha de Borracha com Guizo', category: 'toys', petType: null, priceCents: 1590, promoPriceCents: 990, stock: 0, description: 'Brinquedo resistente para cães e gatos. Esgotado no momento.' },
  { partnerName: 'Petshop Amigo Fiel', name: 'Coleira Peitoral Ajustável M', category: 'accessories', petType: 'dog', priceCents: 6990, stock: 8, description: 'Peitoral acolchoado com regulagem e argola para guia.' },
  { partnerName: 'PetCenter Curitiba', name: 'Arranhador Torre com Plataforma', category: 'toys', petType: 'cat', priceCents: 21990, promoPriceCents: 17990, stock: 3, isFeatured: true, description: 'Arranhador de sisal com duas plataformas e brinquedo pendurado.' },
  { partnerName: 'PetCenter Curitiba', name: 'Shampoo Neutro para Pets 500 ml', category: 'hygiene', petType: null, priceCents: 3290, stock: 15, description: 'Shampoo hipoalergênico, sem perfume forte.' },
  { partnerName: 'PetCenter Curitiba', name: 'Cama Redonda Pelúcia G', category: 'beds', petType: null, priceCents: 14990, stock: 5, description: 'Cama macia com borda alta, lavável na máquina.' },
  { partnerName: 'PetCenter Curitiba', name: 'Mistura de Sementes para Calopsita 1 kg', category: 'food', petType: 'bird', priceCents: 2790, stock: 25, description: 'Mistura de sementes selecionadas para calopsitas e periquitos.' },
  { partnerName: 'PetCenter Curitiba', name: 'Vermífugo para Cães até 10 kg', category: 'health', petType: 'dog', priceCents: 3990, stock: 10, description: 'Consulte o veterinário antes de usar.' },
];

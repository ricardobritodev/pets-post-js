# Entidades

Implementação: `packages/db/prisma/schema.prisma` · Enums: `packages/domain/src/constants.js`

> Na Etapa 1 os nomes físicos (tabelas/colunas) são **idênticos** ao banco Flask.
> Em JS os campos ficam em camelCase (`@map` no Prisma).

## Enums
| Enum | Valores |
|---|---|
| UserRole | `admin`, `user` |
| PostStatus | `lost`, `found` |
| PetType | `dog`, `cat`, `bird`, `other` |
| PetSize | `small`, `medium`, `large` |
| PartnerType | `foster_home`, `petshop`, `vet_clinic` |

## User (`users`)
| Campo | Tipo | Regras |
|---|---|---|
| id | int PK | autoincrement |
| name | varchar(100) | 2–100 caracteres |
| email | varchar(120) | único, minúsculo |
| passwordHash | varchar(256)? | formato Werkzeug (`BR-AUTH-004`) — nunca exposto |
| role | UserRole | padrão `user` |
| phone | varchar(20)? | `BR-VAL-001` |
| avatarUrl | varchar(256)? | não usado ainda |
| isActive | bool | padrão true; false bloqueia login (`BR-AUTH-005`) |
| createdAt | datetime | UTC |

## PetPost (`pet_posts`)
| Campo | Tipo | Regras |
|---|---|---|
| title | varchar(150) | obrigatório |
| description | text | obrigatório |
| status | PostStatus | padrão `lost` |
| petName, petBreed, petColor | varchar(100)? | opcionais |
| petType | PetType | obrigatório |
| petSize | PetSize? | opcional |
| lastSeenLocation | varchar(255) | obrigatório |
| lastSeenLat / Lng | float? | preenchidos por geocodificação (`BR-GEO-001`) |
| contactPhone | varchar(20) | obrigatório, `BR-VAL-001` |
| contactEmail | varchar(120)? | `BR-VAL-002` |
| reward | varchar(100)? | texto livre |
| isActive | bool | padrão true |
| isResolved | bool | padrão false |
| createdAt / updatedAt | datetime | UTC |
| userId | FK → User | dono |

## Photo (`photos`) e AdoptionPhoto (`adoption_photos`)
| Campo | Tipo | Regras |
|---|---|---|
| filename | varchar(256) | UUID hex + extensão |
| url | varchar(512) | `/static/uploads/<filename>` (legado) |
| isPrimary | bool | `BR-PHOTO-002` |
| postId / adoptionPostId | FK | cascade ao excluir o anúncio |

## AdoptionPost (`adoption_posts`)
Mesmos campos de pet do PetPost (sem `status`, `reward`), mais:
`isNeutered`, `isVaccinated` (bool), `adopterRequirements` (text?),
`location` (varchar 255, obrigatório), `locationLat/Lng`, `isAdopted` (bool).

## Partner (`partners`)
`name` (150), `description` (text?), `partnerType`, `address` (255, obrigatório),
`lat/lng`, `phone`, `email`, `website` (URL http/https), `isActive` (visível no mapa).

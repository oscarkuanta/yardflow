import { describe, expect, test } from '@jest/globals';
import { ERD_END, ERD_START, parseSchema, replaceErdBlock, toMermaid } from '../../scripts/erd.js';

const SCHEMA = `
enum Role {
  ADMIN
}

model Company {
  id    Int    @id @default(autoincrement())
  code  String @unique
  users User[]
}

model User {
  id        Int      @id
  role      Role
  companyId Int?
  company   Company? @relation(fields: [companyId], references: [id])
  profile   Profile?
  @@index([companyId])
}

model Profile {
  id     Int  @id
  userId Int  @unique
  user   User @relation(fields: [userId], references: [id])
}
`;

describe('ERD from the Prisma schema', () => {
  test('lists every model with typed and keyed attributes', () => {
    const mermaid = toMermaid(parseSchema(SCHEMA));
    expect(mermaid).toContain('erDiagram');
    expect(mermaid).toContain('    int id PK');
    expect(mermaid).toContain('    string code UK');
    expect(mermaid).toContain('    Role role');
    expect(mermaid).toContain('    int companyId FK');
    expect(mermaid).toContain('    int userId FK, UK');
    expect(mermaid).not.toContain('User[] users');
  });

  test('draws one-to-many, optional and one-to-one relations', () => {
    const mermaid = toMermaid(parseSchema(SCHEMA));
    expect(mermaid).toContain('  Company |o--o{ User : "company"');
    expect(mermaid).toContain('  User ||--o| Profile : "user"');
  });

  test('replaces only the block between the README markers', () => {
    const readme = `# Title\n${ERD_START}\nold\n${ERD_END}\nRest`;
    const updated = replaceErdBlock(readme, 'erDiagram');
    expect(updated).toBe(
      `# Title\n${ERD_START}\n\n\`\`\`mermaid\nerDiagram\n\`\`\`\n\n${ERD_END}\nRest`,
    );
    expect(() => replaceErdBlock('# no markers', 'erDiagram')).toThrow('markers');
  });
});

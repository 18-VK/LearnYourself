import { chain, src } from '../build';

// sql-server/setup-and-security/user-privileges-and-roles › Phase2-ASP.NetAndBackend/SQLTutorial/DB_User_Privilege_Check.md › "## 1. What is a database user?" (code block 1). Transcribed exactly; see curriculum/FLOW_DIAGRAMS.md.
export default chain(
  { id: 'login-user-permissions', title: 'What is a database user?', source: src('Phase2-ASP.NetAndBackend/SQLTutorial/DB_User_Privilege_Check.md', '## 1. What is a database user?', 1) },
  ['Server Login', 'Database User', 'Permissions on database objects'],
);

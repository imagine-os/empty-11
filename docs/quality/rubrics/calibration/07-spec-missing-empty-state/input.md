# Case 07: declared state missing

Spec `specs/crm/contacts-list.md` declares States: `loading`, `loaded`, `empty`, `error`, `offline`. PR implements `apps/web/src/routes/crm/Contacts.tsx` with branches for `loading`, `error` and a table for everything else. With zero contacts the table header renders above blank space. Stories exist for loading and error. Offline is handled by the shell.

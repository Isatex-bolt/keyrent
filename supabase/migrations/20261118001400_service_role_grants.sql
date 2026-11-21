-- KeyRent · 0014 · Il server (service_role) deve poter scrivere sulle tabelle nuove
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;

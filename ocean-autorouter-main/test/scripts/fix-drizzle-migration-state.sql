
-- run this pre-deployment to mark the migration as applied
insert into drizzle.__drizzle_migrations (hash, created_at)
values ('manual', 1759177456000);
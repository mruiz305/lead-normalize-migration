-- Renombra user_org_memberships → hierarchy_membership

SET NAMES utf8mb4;

RENAME TABLE user_org_memberships TO hierarchy_membership;

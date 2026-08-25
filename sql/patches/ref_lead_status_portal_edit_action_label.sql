-- Botones rápidos de cambio de status en Edit Lead (Portal)
-- portal_edit_action_label = texto del botón; portal_edit_action_order = orden solo en Edit Lead
-- leadOrder sigue controlando tabs Case Manager / Active Leads (sin mezclar)

UPDATE refLeadStatus
SET portal_edit_action_label = 'Pending', portal_edit_action_order = 1
WHERE leadStatus = 'Pending';

UPDATE refLeadStatus
SET portal_edit_action_label = 'Drop', portal_edit_action_order = 2
WHERE leadStatus = 'Dropped';

UPDATE refLeadStatus
SET portal_edit_action_label = 'CNA', portal_edit_action_order = 3
WHERE leadStatus = 'CNA';

UPDATE refLeadStatus
SET portal_edit_action_label = NULL, portal_edit_action_order = NULL
WHERE leadStatus NOT IN ('Pending', 'Dropped', 'CNA');

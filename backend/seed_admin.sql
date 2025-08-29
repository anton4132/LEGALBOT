BEGIN;

-- 1) Asegura rol admin
INSERT INTO role (codigo, nombre)
VALUES ('admin', 'Administrador')
ON CONFLICT (codigo) DO NOTHING;

-- 2) UPSERT de persona por dni (dni es unique)
INSERT INTO persona (
  dni, telefono, primer_nombre, segundo_nombre,
  apellido_paterno, apellido_materno, correo, direccion
)
VALUES (
  '00000000', NULL, 'Admin', NULL,
  'LegalBot', NULL, 'admin@legalbot.pe', NULL
)
ON CONFLICT (dni) DO UPDATE SET
  telefono = EXCLUDED.telefono,
  primer_nombre = EXCLUDED.primer_nombre,
  segundo_nombre = EXCLUDED.segundo_nombre,
  apellido_paterno = EXCLUDED.apellido_paterno,
  apellido_materno = EXCLUDED.apellido_materno,
  correo = EXCLUDED.correo,
  direccion = EXCLUDED.direccion;

-- 3) Crea usuario admin SIN hash si no existe aún (clave = 'admin')
INSERT INTO usuario (persona_id, rol_id, clave, telefono_verificado, creado_el)
SELECT p.id, r.id, 'admin', TRUE, NOW()
FROM persona p
JOIN role r ON r.codigo = 'admin'
LEFT JOIN usuario u ON u.persona_id = p.id AND u.rol_id = r.id
WHERE p.dni = '00000000'
  AND u.id IS NULL;

COMMIT;

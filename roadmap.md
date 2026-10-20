# Plataforma real

- [x] Cuentas con nombre y perfil; permisos de administrador y supervisor.
- [x] Guardar instalaciones, RCA y checklists validados.
- [x] Asignar auditorías, guardar respuestas y evidencia fotográfica.
- [x] Enviar, revisar, aprobar o devolver auditorías con comentarios.
- [ ] Verificar extracción de RCA con Orbit: clave y modelo verificados; proveedor rechaza extracción por límite temporal de uso. Confirmación manual disponible.
- [x] Descargar reportes PDF reales, incluyendo fotos.
- [x] Conectar inicio, búsqueda y resúmenes a datos reales.
- [x] Verificar ciclo completo autenticado con administrador y supervisor, persistencia, evidencia, revisión y PDF; eliminar datos de prueba.
- [ ] Asignar primer administrador: espera una cuenta real identificada por el usuario; nunca promover automáticamente al primer registro público.
- [x] Tipos de instalación: piscicultura, centro, planta de proceso y empresa (selector corregido).
- [x] Checklist mixto: Orbit lee la RCA y la cruza con la normativa del tipo (fuente: repo ankker-hackaton, docs/otras-entidades.md, sernapesca.md y permisos-por-instalacion.md); el responsable valida.
- [x] Una RCA por instalación; pertinencias adjuntas que suman compromisos al checklist al confirmarlas.
- [x] Agente interno en el chat de Inicio con herramientas de la plataforma (src/lib/agente/herramientas.ts); las escrituras se confirman con un botón.
- [ ] Probar el agente con Orbit en vivo (depende del límite de uso del proveedor y de que el modelo acepte herramientas; si no, responde con un resumen como contexto).

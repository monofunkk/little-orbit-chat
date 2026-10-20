import type { ChecklistItem, TipoInstalacion } from './domain';

/**
 * Obligaciones que la normativa impone a cada tipo de instalación, además de su RCA.
 * Fuente: repo monofunkk/ankker-hackaton — docs/otras-entidades.md (ids MMA, SAL, SST, SSF, DIR, SUB, DGA, SEC, MUN),
 * docs/sernapesca.md (ids SNP) y docs/permisos-por-instalacion.md (ids PER). Investigado el 20/10/2026.
 * No es la checklist final: Orbit la cruza con la RCA de la instalación y el responsable valida el resultado.
 */
export interface ObligacionNormativa { clave:string; descripcion:string; categoria:ChecklistItem['categoria']; evidencia:ChecklistItem['evidencia']; referencia:string; organismo:string }

const o = (clave:string, organismo:string, descripcion:string, categoria:ObligacionNormativa['categoria'], evidencia:ObligacionNormativa['evidencia'], referencia:string): ObligacionNormativa => ({ clave, organismo, descripcion, categoria, evidencia, referencia });

const retcDja = o('MMA-01','MMA','Declaración Jurada Anual (DJA) del RETC enviada durante octubre por el encargado del establecimiento.','Documental','Documental','Res. Ex. MMA 144/2020, art. 11; DS 1/2013 MMA, arts. 16 y 18');
const sidrep = o('SAL-03','SEREMI de Salud','Cada retiro de residuos peligrosos declarado en SIDREP con transportista y destino autorizados; copia guardada 2 años.','Ambiental','Documental','DS 148/2003 MINSAL, arts. 27 c), 80, 81, 83 y 84');
const respelPlan = o('SAL-02','SEREMI de Salud','Plan de Manejo de Residuos Peligrosos vigente si se generan más de 12 kg/año de tóxicos agudos o más de 12 t/año de otros.','Ambiental','Documental','DS 148/2003 MINSAL, arts. 25-27');
const suspelSimulacro = o('SAL-06','SEREMI de Salud','Plan de emergencias de sustancias peligrosas con simulacro, capacitación y revisión anual.','Operacional','Documental','DS 43/2015 MINSAL, arts. 190 i) y 191');
const comite = o('SST-05','Dirección del Trabajo','Comité Paritario constituido (faena con más de 25 trabajadores) con sesión mensual y actas al día.','Documental','Documental','DS 44/2023 MINTRAB, arts. 23, 36, 39 y 43; Ley 16.744, art. 66');
const matriz = o('SST-01','Dirección del Trabajo / SEREMI','Matriz de peligros y evaluación de riesgos revisada al menos una vez al año y después de cada accidente o cambio.','Operacional','Documental','DS 44/2023 MINTRAB, art. 7');
const emergencias = o('SST-04','SEREMI de Salud','Plan de emergencias ensayado con un simulacro al menos una vez al año.','Operacional','Documental','DS 44/2023 MINTRAB, art. 19');
const accidente = o('SST-10','Inspección del Trabajo / SEREMI','Ante accidente grave o fatal: suspender la faena, avisar de inmediato a la Inspección y la SEREMI y enviar la DIAT a la mutual.','Operacional','Declarativa','Ley 16.744, art. 76; Compendio SUSESO, Libro IV');
const combustible = o('SEC-02','SEC','Estanques de combustible con manual de operación revisado cada año, plan de mantenimiento y registro foliado de inspecciones.','Operacional','Documental','DS 160/2008, arts. 23, 24, 102, 104, 106 y 164 a)');
const concesionMaritima = o('SSF-01','SSFFAA','Concesión marítima vigente para emisario, toma de agua, salmoducto o muelle (si los tiene).','Documental','Documental','DFL 340/1960, arts. 2-3; DS 9/2018, art. 6; DS 1/1992, art. 146');
const rentaMaritima = o('SSF-02','SSFFAA / TGR','Renta anual de la concesión marítima pagada a tiempo (el atraso de un año es causal de caducidad).','Documental','Documental','DS 9/2018, arts. 105 a), 117, 129 y 132; DFL 340, arts. 4 y 7');
const renovacionMaritima = o('SSF-04','SSFFAA','Renovación de la concesión marítima pedida al menos 6 meses antes de su vencimiento.','Documental','Documental','DS 9/2018, art. 51');
const veterinario = o('SNP-05','Sernapesca','Visita del médico veterinario al menos una vez al mes mientras haya peces, con motivo, hallazgos, tratamientos y muestras.','Operacional','Documental','RESA (DS 319/2001), art. 21 bis');
const contingencias = o('SNP-16','Sernapesca','Plan de contingencias aprobado (mortalidad masiva, falla del sistema de mortalidad, escapes) y aviso inmediato a Sernapesca, Autoridad Marítima y SMA ante un evento.','Documental','Documental','RAMA (DS 320/2001), arts. 5, 5 A y 5 B; RESA art. 22 A');
const tope = o('SUB-01','Subpesca / Sernapesca','La producción no supera la producción máxima aprobada en la RCA.','Operacional','Declarativa','RAMA (DS 320/2001), art. 15 inc. 3');

export const normativaPorTipo: Record<TipoInstalacion, ObligacionNormativa[]> = {
  piscicultura: [
    o('SNP-18','Sernapesca','Inscripción vigente en el Registro Nacional de Acuicultura, con toda modificación del proyecto técnico anotada.','Documental','Documental','LGPA, arts. 67 y 90 ter; DS 499/1994, arts. 8 y 10'),
    tope,
    o('DGA-01','DGA','Monitoreo de extracciones efectivas de los pozos: obra registrada con QR visible, caudalímetro con totalizador y envío según el caudal.','Operacional','Documental','Res. DGA 1238/2019; Código de Aguas, arts. 67-68'),
    concesionMaritima, rentaMaritima,
    o('SNP-01','Sernapesca','Mortalidad retirada y clasificada a diario por unidad y causa, con registro firmado.','Operacional','Documental','RESA (DS 319/2001), art. 22 A'),
    veterinario,
    o('SNP-07','Sernapesca','Tratamientos y antibióticos usados informados en SIFA a más tardar el día 12 del mes siguiente.','Documental','Documental','RESA art. 12; DS 129, art. 8 e)'),
    o('SNP-09','Sernapesca','Existencias, cosecha y situación sanitaria declaradas en SIFA cada mes (día 12); ingresos y egresos de peces en 48 h.','Documental','Documental','DS 129, arts. 7 a) y 8'),
    o('SNP-10','Sernapesca','Certificado Sanitario de Movimiento pedido al menos 2 días hábiles antes de cada traslado de peces.','Documental','Documental','Res. Sernapesca 1577/2011, 10.1; DS 129, art. 8 a)'),
    o('SNP-15','Sernapesca','Recirculación: paralizar, limpiar y desinfectar todo el sistema cada 2 años.','Operacional','Documental','RESA, arts. 23 N y 23 Q'),
    contingencias,
    o('SAL-07','SEREMI de Salud','Estanque criogénico de oxígeno: inspección mensual de conexiones y válvulas, visual anual y certificación INN cada 5 años.','Operacional','Fotográfica','DS 43/2015 MINSAL, arts. 141-145'),
    retcDja, respelPlan, sidrep, suspelSimulacro, comite,
  ],
  centro: [
    o('SUB-04','Subpesca / SSFFAA','Concesión de acuicultura vigente (25 años si es posterior a 2010), sin INFA negativas que impidan renovarla.','Documental','Documental','LGPA (DS 430/1991), art. 69'),
    o('SUB-02','TGR / Subpesca','Patente Única de Acuicultura pagada en el año (20 UTM/ha para peces exóticos).','Documental','Documental','LGPA (DS 430/1991), art. 84'),
    o('SUB-03','Subpesca / SSFFAA','Concesión en operación: sin paralización mayor a 2 años ni patente impaga (causales de caducidad).','Operacional','Declarativa','LGPA, art. 142'),
    o('PER-01','SMA / Subpesca','Producción del ciclo dentro del menor límite entre la RCA, el proyecto técnico y la densidad del barrio (ACS).','Operacional','Declarativa','RAMA (DS 320/2001), art. 15; RESA (DS 319/2001)'),
    o('PER-02','Sernapesca','INFA (Información Ambiental) anual entregada; si resulta anaeróbica no se vuelve a sembrar hasta recuperar el sitio.','Ambiental','Documental','RAMA (DS 320/2001)'),
    o('PER-03','Sernapesca','Descanso coordinado del barrio (ACS) entre ciclos y densidad de cultivo fijada para el semestre respetados.','Operacional','Declarativa','RESA (DS 319/2001)'),
    o('SNP-02','Sernapesca','Mortalidad clasificada por causa reportada en SIFA cada semana (a más tardar el primer día hábil de la siguiente).','Documental','Documental','DS 129, art. 8 b)'),
    veterinario, contingencias,
    o('SNP-17','Sernapesca','Ante un escape: aviso en 24 h con estado sanitario, recaptura en 30 días e informe en 15 días hábiles.','Operacional','Documental','RESA art. 74; RAMA art. 6; LGPA art. 70 bis'),
    o('DIR-02','Directemar','Plan de contingencia por derrames de hidrocarburos aprobado (5 años) con evaluación anual y ejercicios registrados.','Documental','Documental','Circular DGTM A-53/003; DS 1/1992, arts. 12 y 15'),
    o('DIR-03','Directemar','Buceo: matrícula anual de buzos y supervisores, equipos certificados, permiso por faena y bitácora de inmersiones.','Operacional','Documental','DS 752/1982, arts. 502-509, 602-604, 801-803'),
    o('DIR-04','Directemar','Pontones y artefactos navales con matrícula e inspección anual (certificado de navegabilidad).','Documental','Documental','Circular DGTM O-71/010'),
    accidente,
  ],
  planta_proceso: [
    o('PER-04','Sernapesca','Inscripción vigente en el Registro de Plantas de Transformación (caduca si la planta no opera 2 años) y trazabilidad declarada.','Documental','Documental','Registro de Plantas de Transformación, Sernapesca'),
    o('PER-05','SMA','Residuos líquidos descargados según la norma de emisión DS 90/2000 (o la de alcantarillado), con autocontrol.','Ambiental','Documental','DS 90/2000; Ley 19.300'),
    o('DIR-01','Directemar','Descarga por emisario autorizada por la DGTM, con bioensayos y autocontrol según la resolución.','Ambiental','Documental','DS 1/1992, arts. 139-142'),
    concesionMaritima, rentaMaritima, renovacionMaritima,
    o('PER-06','SEREMI de Salud','Autorización sanitaria de la planta vigente según el Reglamento Sanitario de los Alimentos.','Documental','Documental','DS 977/1996 MINSAL'),
    o('PER-07','Sernapesca','Habilitación y certificación de Sernapesca vigentes para cada mercado de exportación.','Documental','Documental','RESA, art. 32 A; certificación de exportación Sernapesca'),
    o('SST-12','MINSAL / mutual','Protocolos PREXOR (ruido) y TMERT aplicados con sus evaluaciones vigentes.','Operacional','Documental','Protocolos MINSAL de salud ocupacional'),
    retcDja, respelPlan, sidrep, comite, combustible, accidente,
  ],
  empresa: [
    o('SST-06','Dirección del Trabajo','Departamento de Prevención de Riesgos con experto a cargo (empresa con más de 100 trabajadores).','Documental','Documental','DS 44/2023 MINTRAB, arts. 50 y 66'),
    o('SST-07','Dirección del Trabajo / SEREMI','Reglamento Interno de Orden, Higiene y Seguridad revisado cada año, enviado a la DT y al MINSAL y entregado a cada trabajador.','Documental','Documental','Código del Trabajo, arts. 153 y 156; DS 44/2023, arts. 56-58'),
    o('SST-08','Dirección del Trabajo','Ley Karin: protocolo de prevención del acoso y la violencia vigente y canales de denuncia informados cada semestre.','Documental','Documental','Código del Trabajo, art. 211-A'),
    o('SST-09','Dirección del Trabajo','Denuncias de acoso: resguardo inmediato, investigación o derivación a la DT en 3 días y cierre en 30 días.','Operacional','Documental','Código del Trabajo, arts. 211-B bis, 211-C y 211-E'),
    o('SST-03','Dirección del Trabajo','Capacitación en seguridad y salud de al menos 8 horas, al ingreso y cada 2 años como máximo.','Documental','Documental','DS 44/2023 MINTRAB, arts. 15-16'),
    o('SST-11','MINSAL / SUSESO','Evaluación de riesgos psicosociales (CEAL-SM/SUSESO) cada 2 años.','Documental','Documental','Res. Ex. MINSAL 1448/2022; Circular SUSESO 3709/2022'),
    o('MMA-02','MMA','Formularios de desempeño ambiental del RETC (producción, inversión y costos de control) enviados cada junio.','Documental','Documental','Res. Ex. MMA 144/2020, arts. 3 n°4 y 10'),
    o('MMA-05','MMA','Ley REP: declaración anual como productor si la empresa importa para uso propio aceites, neumáticos o baterías, o vende productos envasados.','Documental','Documental','Ley 20.920, arts. 3 n°21 c) y 10'),
    o('MUN-01','Municipalidad','Patente municipal pagada en sus dos cuotas anuales.','Documental','Documental','DL 3063, art. 24'),
    matriz, emergencias,
  ],
};

export function itemsNormativos(tipo:TipoInstalacion, rcaId:string, omitir:ReadonlySet<string> = new Set()): ChecklistItem[] {
  return normativaPorTipo[tipo].filter(x=>!omitir.has(x.clave)).map(x=>({ id:crypto.randomUUID(), rcaId, descripcion:x.descripcion, categoria:x.categoria, evidencia:x.evidencia, referencia:`${x.clave} · ${x.referencia}`, origen:'Normativa' as const, clave:x.clave, fuente:x.organismo }));
}

/**
 * Alcance declarado de la auditoría y traducción de cada control a impacto de
 * negocio en una frase. Se mantiene en el frontend para que también aplique a
 * ejecuciones históricas guardadas antes de introducir estos textos.
 */

/** Nº aproximado de controles del CIS AWS Foundations Benchmark v3.0.0 completo. */
export const CIS_TOTAL_CONTROLS = 60;

/** Secciones del benchmark que esta versión aún no cubre. */
export const CIS_UNCOVERED_AREAS = [
  "Config Rules y conformidad continua (sección 3 completa)",
  "Alarmas y filtros de métricas de CloudWatch (sección 4)",
  "S3 en profundidad: políticas de bucket, ACL y registro de acceso",
  "RDS más allá de exposición pública, cifrado y actualizaciones menores",
  "Lambda, EKS, ECS y servicios gestionados adicionales",
  "KMS, rotación de claves y gestión de secretos",
];

export function cisScopeTitle(evaluatedControls: number, benchmark: string): string {
  return `Evaluación basada en un subconjunto priorizado de ${evaluatedControls} controles del ${benchmark} (de un total de ~${CIS_TOTAL_CONTROLS})`;
}

export function cisRegionNotice(region: string): string {
  return `Esta auditoría cubre exclusivamente la región ${region}. Varios controles (cifrado EBS por defecto, grupos de seguridad, VPC, RDS) son configuraciones por región: se recomienda repetir la auditoría en cada región activa de la cuenta.`;
}

/** Impacto de negocio, en lenguaje no técnico, por identificador de control. */
export const CIS_BUSINESS_IMPACT: Record<string, string> = {
  "1.4": "Si esas claves se filtran, quien las tenga controla la cuenta entera sin ningún límite y sin posibilidad de restringirle permisos.",
  "1.5": "Con solo la contraseña de root, un atacante puede tomar el control total de la cuenta, borrar copias de seguridad y bloquear tu acceso.",
  "1.8": "Las contraseñas cortas se adivinan por fuerza bruta en poco tiempo, dando acceso directo a la consola de AWS.",
  "1.10": "Una contraseña robada basta para entrar en la consola, sin ningún segundo factor que lo impida.",
  "1.14": "Una clave antigua y filtrada hace tiempo sigue funcionando hoy: el acceso del atacante nunca caduca.",
  "2.1.1": "Los archivos guardados quedan legibles si alguien accede al almacenamiento subyacente o a una copia de los datos.",
  "2.1.3": "Un borrado accidental o un ataque de ransomware deja los archivos sin ninguna versión anterior que recuperar.",
  "2.1.4": "Cualquier persona en Internet podría llegar a listar y descargar los archivos del bucket.",
  "2.2.1": "Los discos nuevos se crean sin cifrar, así que los datos viajan y se almacenan sin protección frente a copias no autorizadas.",
  "2.3.1": "La base de datos y sus copias quedan sin cifrar: cualquier acceso al almacenamiento expone la información de clientes.",
  "2.3.2": "La base de datos se queda sin parches de seguridad publicados por AWS, quedando vulnerable a fallos ya conocidos.",
  "2.3.3": "La base de datos es alcanzable desde Internet, así que cualquiera puede intentar conectarse y probar credenciales.",
  "3.1": "Sin registro de actividad no se puede saber quién hizo qué: un incidente sería imposible de investigar o demostrar.",
  "3.2": "Los registros podrían alterarse sin dejar rastro, lo que invalida cualquier prueba en una investigación o auditoría.",
  "3.9": "No hay visibilidad del tráfico de red, así que una intrusión o una fuga de datos pasarían desapercibidas.",
  "5.2": "Esto permite que cualquiera en Internet intente acceder directamente a tus servidores y probar contraseñas sin límite.",
  "5.4": "Recursos creados por error pueden quedar accesibles sin que nadie lo decida explícitamente.",
  "5.6": "Un fallo en una aplicación web puede usarse para robar las credenciales del servidor y moverse por el resto de la cuenta.",
};

export function cisImpact(id: string): string | null {
  return CIS_BUSINESS_IMPACT[id] ?? null;
}

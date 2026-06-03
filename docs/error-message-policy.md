# Politica Publica de Mensajes de Error

Esta guia define como deben exponerse los errores visibles para usuario en frontend y microservicios.

## Principios

- Describir el efecto para la persona usuaria, no el mecanismo interno.
- No mencionar nombres de microservicios, bases de datos, brokers, protocolos ni dependencias.
- No exponer stack traces, hosts, rutas internas ni mensajes crudos de infraestructura.
- Mantener mensajes claros, accionables y consistentes entre servicios.
- Preservar detalles tecnicos solo en logs internos.

## Formato Publico

Las respuestas HTTP y mensajes de socket deben incluir:

- `status`: codigo HTTP correcto cuando aplique.
- `error`: codigo interno o tecnico existente para compatibilidad.
- `code`: codigo publico estable orientado a producto.
- `message`: mensaje sanitizado y visible para usuario.
- `details`: solo si son seguros y utiles, por ejemplo validaciones de formulario.

## Taxonomia Publica

| `code` | Mensaje base | Uso esperado |
| --- | --- | --- |
| `network_unreachable` | `No se pudo conectar. Revisa tu conexion e intentalo de nuevo.` | La solicitud no salio del cliente o no hubo conectividad. |
| `service_temporarily_unavailable` | `Esta funcion no esta disponible en este momento. Intenta de nuevo mas tarde.` | Dependencia caida, rechazada o fuera de servicio. |
| `request_timeout` | `La solicitud tardo demasiado y no se pudo completar. Intenta nuevamente.` | Tiempo de espera agotado. |
| `resource_not_found` | `El contenido solicitado ya no esta disponible.` | Recurso inexistente o retirado. |
| `invalid_input` | `Revisa la informacion ingresada e intentalo nuevamente.` | Validaciones, formato invalido o datos faltantes. |
| `forbidden` | `No tienes permisos para esta accion.` | El usuario no puede realizar la operacion. |
| `unauthorized` | `Tu sesion expiro. Inicia sesion nuevamente.` | Sesion faltante, invalida o vencida. |
| `conflict_or_state_changed` | `El contenido cambio y la accion ya no pudo completarse.` | Estado obsoleto, duplicados o conflictos. |
| `dependency_validation_failed` | `No se pudo validar la informacion relacionada con esta accion.` | Validacion de recurso vinculado o metadata relacionada. |
| `unexpected_operation_failure` | `No se pudo completar la accion en este momento. Intenta de nuevo mas tarde.` | Falla no clasificada o inesperada. |

## Reglas de Redaccion

- Preferir mensajes en lenguaje de producto.
- Incluir una accion sugerida cuando aporte valor: reintentar, revisar datos o iniciar sesion.
- Evitar mensajes vagos cuando exista una categoria mas precisa.
- Si un mensaje de negocio ya es claro y seguro, puede conservarse.

## Casos Especiales

- `ACCOUNT_BANNED` puede mantenerse como codigo de negocio explicito.
- Los logs internos pueden conservar nombres tecnicos para diagnostico, pero nunca el mensaje publico.

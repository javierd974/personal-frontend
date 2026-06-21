# SmartDom - Sistema de Gestión de Personal Gastronómico

Sistema web completo para la gestión de horarios de personal en locales gastronómicos, desarrollado con React + Vite y Supabase.

## 📋 Características Principales

- **Autenticación de Usuarios**: Sistema de login seguro con Supabase Auth
- **Registro de Horarios**: Control de entrada y salida de empleados con validaciones
- **Gestión Multi-Local**: Los encargados pueden gestionar múltiples locales
- **Roles Dinámicos**: Asignación de roles por turno a cada empleado
- **Vales de Caja**: Registro de vales entregados al personal
- **Control de Ausencias**: Registro de ausencias con motivos predefinidos
- **Cierre de Turno**: Generación automática de reportes completos
- **Preparado para Biometría**: Estructura lista para integrar lectores biométricos
- **Diseño Responsive**: Funciona perfectamente en desktop, tablet y móvil
- **Branding SmartDom**: Diseño profesional con la identidad de SmartDom

## 🚀 Tecnologías Utilizadas

- **Frontend**: React 18, Vite
- **Estilos**: Tailwind CSS
- **Backend**: Supabase (BaaS)
- **Base de Datos**: PostgreSQL (Supabase)
- **Autenticación**: Supabase Auth
- **Routing**: React Router DOM
- **Iconos**: Lucide React
- **Fechas**: date-fns

## 📦 Instalación

### 1. Clonar o Descargar el Proyecto

```bash
cd gestion-personal-smartdom
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Supabase

#### a) Crear un Proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Crea una cuenta o inicia sesión
3. Crea un nuevo proyecto
4. Anota la URL y la clave anónima (anon key)

#### b) Ejecutar el Script SQL

1. En tu proyecto de Supabase, ve a "SQL Editor"
2. Crea una nueva query
3. Copia y pega todo el contenido del archivo `supabase_schema.sql`
4. Ejecuta el script (Run)

Esto creará:
- Todas las tablas necesarias
- Relaciones entre tablas
- Políticas de seguridad (RLS)
- Triggers automáticos
- Datos iniciales (roles y motivos de ausencia)

#### c) Verificar Políticas de Seguridad

1. Ve a "Authentication" > "Policies" en Supabase
2. Verifica que las políticas RLS estén habilitadas en todas las tablas
3. Asegúrate de que los triggers estén activos

### 4. Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

Edita el archivo `.env` y agrega tus credenciales de Supabase:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anonima-aqui
```

### 5. Crear el Primer Usuario (Encargado)

#### Opción A: Desde Supabase Dashboard

1. Ve a "Authentication" > "Users" en Supabase
2. Haz clic en "Add user" > "Create new user"
3. Ingresa:
   - Email: tu@email.com
   - Password: tu contraseña segura
   - User Metadata (opcional):
     ```json
     {
       "nombre": "Tu Nombre",
       "apellido": "Tu Apellido"
     }
     ```
4. El trigger automático creará el registro en la tabla `usuarios`

#### Opción B: Desde SQL Editor

```sql
-- Nota: Esto solo funciona si tienes acceso directo a la BD
-- Normalmente se hace desde el dashboard de Supabase
```

### 6. Asignar Local al Usuario

Ejecuta en SQL Editor:

```sql
-- Primero crea un local de prueba
INSERT INTO locales (nombre, direccion, telefono)
VALUES ('Local de Prueba', 'Calle Falsa 123', '1234567890');

-- Asigna el local al usuario (reemplaza los IDs)
INSERT INTO usuarios_locales (usuario_id, local_id)
VALUES (
  'id-del-usuario-desde-auth-users',
  'id-del-local-recien-creado'
);
```

O puedes obtener los IDs con:

```sql
-- Ver usuarios
SELECT id, email FROM auth.users;

-- Ver locales
SELECT id, nombre FROM locales;
```

### 7. Crear Empleados de Prueba

```sql
-- Crear algunos empleados
INSERT INTO empleados (nombre, apellido, documento, telefono) VALUES
('Juan', 'Pérez', '12345678', '1122334455'),
('María', 'González', '87654321', '1155667788'),
('Carlos', 'Rodríguez', '11223344', '1199887766');

-- Asignarlos al local (reemplaza el local_id)
INSERT INTO empleados_locales (empleado_id, local_id)
SELECT e.id, 'id-del-local-aqui'
FROM empleados e;
```

## 🎯 Uso del Sistema

### Iniciar el Servidor de Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

### Flujo de Trabajo

1. **Login**: Ingresa con tu email y contraseña
2. **Dashboard**: 
   - Selecciona el local desde el selector
   - Ve el resumen del día actual
3. **Registrar Entrada**:
   - Clic en "Registrar Entrada"
   - Selecciona empleado y rol
   - Agrega observaciones opcionales
   - Confirma
4. **Registrar Salida**:
   - En la lista de empleados en turno
   - Clic en "Registrar Salida" del empleado correspondiente
5. **Vales de Caja**:
   - Clic en "Registrar Vale"
   - Selecciona empleado, importe y concepto
6. **Ausencias**:
   - Clic en "Registrar Ausencia"
   - Selecciona empleado y motivo
7. **Cierre de Turno**:
   - Ve a la pestaña "Cierre de Turno"
   - Selecciona tipo de turno
   - Agrega observaciones generales
   - Genera vista previa
   - Confirma cierre

## 🔧 Construcción para Producción

### Build

```bash
npm run build
```

Esto generará los archivos optimizados en la carpeta `dist/`

### Preview del Build

```bash
npm run preview
```

## 🚢 Despliegue en VPS (Docker Swarm)

El despliegue se realiza en la VPS mediante el script `deploy_personal.sh`
(ubicado en `/usr/local/bin/deploy_personal.sh`), que automatiza todo el flujo.

### 1. Subir los cambios

```bash
git add .
git commit -m "..."
git push origin main
```

### 2. Ejecutar el deploy en la VPS

Conectarse por SSH y correr el script:

```bash
ssh -i ~/.ssh/id_ed25519_personal root@46.202.147.30
bash /usr/local/bin/deploy_personal.sh
```

### 3. Qué hace el script

1. Entra al repo en `/opt/personal/app`
2. Trae la última versión: `git fetch origin` + `git reset --hard origin/main`
3. Reconstruye la imagen Docker: `docker build --no-cache -t personal:prod .`
   (inyecta `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` como build args)
4. Reinicia el servicio: `docker service update --force personal_front`

> Nota: el build se hace sin caché, por lo que puede tardar varios minutos.

## 📱 Funcionalidades Futuras

### Lector Biométrico

El sistema está preparado para integrar lectores biométricos:

1. **Campo en BD**: La tabla `empleados` tiene el campo `huella_digital`
2. **Método de Registro**: Los registros tienen el campo `metodo_registro`
3. **Implementación Sugerida**:
   - Conectar lector biométrico vía USB/Web API
   - Al registrar entrada/salida, verificar huella
   - Guardar referencia en el campo correspondiente

### Frontend de RRHH

Próxima fase: crear interfaz para el departamento de Recursos Humanos con:
- Reportes avanzados
- Liquidación de sueldos
- Gestión de empleados y locales
- Dashboard analítico

## 🎨 Guía de Diseño

El sistema sigue la guía de diseño UI/UX de SmartDom:

- **Colores Primarios**:
  - Azul: `#0B9FD9` (Primary)
  - Naranja: `#F59120` (Secondary)
  - Oscuro: `#2D3E50` (Dark)

- **Tipografía**: Inter

- **Componentes**: Diseñados según las mejores prácticas definidas

Ver `GUIA_DE_DISENO_UI_UX__simil_gestion_vehiculos_.md` para más detalles.

## 📊 Estructura del Proyecto

```
gestion-personal-smartdom/
├── public/
├── src/
│   ├── components/
│   │   ├── common/          # Componentes reutilizables
│   │   ├── registros/       # Componentes de registro
│   │   └── reportes/        # Componentes de reportes
│   ├── pages/               # Páginas principales
│   ├── services/            # Servicios de API
│   ├── App.jsx              # Componente principal
│   ├── main.jsx            # Punto de entrada
│   └── index.css           # Estilos globales
├── supabase_schema.sql     # Script de base de datos
├── package.json
├── vite.config.js
├── tailwind.config.js
└── README.md
```

## 🔐 Seguridad

- **Autenticación**: JWT tokens mediante Supabase Auth
- **RLS (Row Level Security)**: Políticas a nivel de fila en PostgreSQL
- **Validaciones**: En cliente y servidor
- **HTTPS**: Recomendado en producción
- **Variables de Entorno**: Nunca commitear `.env` en Git

## 🐛 Solución de Problemas

### Error: "No se pueden cargar los locales"

- Verifica que el usuario esté asignado a al menos un local
- Revisa las políticas RLS en Supabase

### Error: "No se puede registrar entrada"

- Verifica que el empleado exista y esté activo
- Revisa que el empleado esté asignado al local
- Confirma que no tenga una entrada sin salida previa

### Error de Autenticación

- Verifica las credenciales de Supabase en `.env`
- Revisa que la URL y anon key sean correctas
- Confirma que el usuario existe en Auth > Users

## 📞 Soporte

Para soporte o consultas sobre el sistema, contacta a SmartDom.

## 📄 Licencia

© 2025 SmartDom. Todos los derechos reservados.

---

**Desarrollado por SmartDom**  
🌐 smartdom.io
# personal-frontend

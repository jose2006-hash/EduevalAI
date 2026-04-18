# 🎓 AcademIA — Plataforma de Evaluación Académica con IA

Sistema de evaluación automática de trabajos académicos usando **Firebase** + **OpenAI GPT-4o**.

---

## 🚀 Características

| Funcionalidad | Descripción |
|---|---|
| 🤖 Evaluación con IA | GPT-4o evalúa trabajos según la rúbrica del docente |
| 📋 Gestión de Rúbricas | Crea criterios personalizados con niveles y pesos |
| 📊 Dashboard Docente | Gráficas, estadísticas, historial de evaluaciones |
| 👤 Portal del Alumno | Cada alumno ve sus notas y retroalimentación |
| 🔐 Autenticación | Login separado para docentes y alumnos |
| ☁️ Firebase | Firestore para datos, Auth para usuarios |

---

## 📁 Estructura del Proyecto

```
academia-ai/
├── src/
│   ├── firebase/
│   │   ├── config.js          # Inicialización Firebase
│   │   └── services.js        # CRUD: usuarios, cursos, rúbricas, evaluaciones
│   ├── openai/
│   │   └── evaluador.js       # Lógica de evaluación con GPT-4o
│   ├── components/
│   │   └── AuthContext.jsx    # Contexto de autenticación React
│   ├── pages/
│   │   ├── Login.jsx          # Página de inicio de sesión
│   │   ├── DashboardDocente.jsx  # Dashboard con gráficas (Chart.js)
│   │   ├── EvaluarTrabajo.jsx    # Flujo de evaluación de 3 pasos
│   │   ├── GestionRubricas.jsx   # CRUD de rúbricas
│   │   ├── GestionAlumnos.jsx    # CRUD de alumnos
│   │   └── VistaAlumno.jsx       # Portal de notas del alumno
│   ├── App.jsx                # Router con rutas protegidas por rol
│   └── main.jsx               # Entry point
├── index.html
├── vite.config.js
├── package.json
└── .env.example               # Variables de entorno (copiar a .env)
```

---

## ⚙️ Instalación Paso a Paso

### 1. Instalar dependencias
```bash
cd academia-ai
npm install
```

### 2. Configurar Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com)
2. Crea un nuevo proyecto (ej: `academia-ai`)
3. Activa **Authentication** → Email/Password
4. Activa **Firestore Database** → Modo producción
5. Ve a Configuración del Proyecto → Agrega una app Web
6. Copia las credenciales

### 3. Configurar variables de entorno
```bash
# Copia el archivo de ejemplo
cp .env.example .env

# Edita .env con tus credenciales reales:
# VITE_FIREBASE_API_KEY=...
# VITE_OPENAI_API_KEY=sk-...
```

### 4. Configurar reglas de Firestore

En Firebase Console → Firestore → Reglas, pega:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### 5. Ejecutar en desarrollo
```bash
npm run dev
```
Abre [http://localhost:5173](http://localhost:5173)

---

## 👥 Roles de Usuario

### Docente (`rol: "docente"`)
- Accede al dashboard con estadísticas
- Crea y gestiona rúbricas
- Evalúa trabajos con IA
- Ve el historial de todas las evaluaciones

### Alumno (`rol: "alumno"`)
- Ve únicamente sus propias evaluaciones
- Accede a retroalimentación detallada por criterio
- Ve fortalezas, áreas de mejora y recomendaciones

---

## 🔧 Crear el primer docente

Dado que no hay registro público de docentes, créalo directamente desde código o Firebase Console:

```javascript
// Desde la consola del navegador en localhost, ejecuta:
import { registerUser } from './src/firebase/services.js';
await registerUser('docente@academia.edu', 'password123', 'Prof. García', 'docente');
```

O desde Firebase Console → Authentication → Agregar usuario manualmente, luego en Firestore agrega:
```json
// Colección: usuarios
{
  "uid": "EL_UID_DEL_USUARIO",
  "email": "docente@academia.edu",
  "nombre": "Prof. García",
  "rol": "docente"
}
```

---

## 📊 Colecciones en Firestore

```
usuarios/          → uid, email, nombre, rol, cursoId
cursos/            → nombre, descripcion, docenteUid
rubricas/          → nombre, cursoId, puntajeTotal, criterios[]
evaluaciones/      → alumnoUid, alumnoNombre, cursoId, rubricaId, tema,
                     trabajoTexto, notaFinal, nivelGlobal, criterios[],
                     fortalezas[], areasDesMejora[], retroalimentacionGeneral,
                     recomendaciones[], docenteUid, creadoEn
```

---

## 🤖 Cómo funciona la IA

1. Docente selecciona alumno, curso, rúbrica y tema
2. Pega el texto del trabajo del alumno
3. El sistema envía a GPT-4o: **trabajo + rúbrica completa**
4. GPT-4o devuelve JSON estructurado con:
   - Nota por criterio (con nivel y comentario)
   - Nota final sobre 20
   - Fortalezas del trabajo
   - Áreas de mejora
   - Retroalimentación general
   - Recomendaciones específicas
5. Se guarda en Firestore y el alumno puede verlo en su portal

---

## 🏗️ Build para producción

```bash
npm run build
# Los archivos quedan en /dist — despliega en Firebase Hosting, Vercel o Netlify
```

### Deploy en Firebase Hosting:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

---

## 💡 Próximas mejoras sugeridas

- [ ] Subida de PDFs (el alumno sube su trabajo como PDF)
- [ ] Material académico propio para entrenar el contexto de la IA
- [ ] Exportar reportes a Excel/PDF
- [ ] Notificaciones por email cuando hay nueva evaluación
- [ ] Comparativa de progreso del alumno en el tiempo
- [ ] App móvil con React Native

---

Desarrollado con ❤️ | Firebase + OpenAI GPT-4o + React + Vite

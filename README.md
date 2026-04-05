# RAG-Productos

Repositorio del proyecto **RAG-Productos**, un sistema de **RAG (Retrieval-Augmented Generation)** construido en **Node.js** con almacenamiento en SQLite y procesamiento de PDFs.

---

## ⚡ Tecnologías principales

- **Node.js** v18+  
- **Express 5** para servidor web  
- **SQLite (better-sqlite3)** para almacenamiento local  
- **dotenv** para variables de entorno  
- **@xenova/transformers** para modelos de ML  
- **pdfjs-dist** para procesamiento de PDFs  

---

## 🔐 Seguridad

- El archivo `.env` **no se encuentra en el repositorio** y está en `.gitignore`.  
- No se suben bases de datos ni archivos temporales (`.db`, `.save`, `nohup.out`).  
- Archivos sensibles deben agregarse a `.gitignore` si surgen nuevos.  
- Se recomienda habilitar en GitHub: **Dependabot**, **Code Scanning** y **Secret scanning**.  

---

## 📦 Instalación

Clona el repositorio:

```bash
git clone git@github.com:AleSrv/rag-productos.git
cd rag-productos

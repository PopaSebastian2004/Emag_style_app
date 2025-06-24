<!DOCTYPE html>
<html lang="ro" prefix="schema: http://schema.org/ sa: https://ns.science.ai/">
<head>
  <meta charset="utf-8">
  <title>Documentație Proiect Web – I rate it!</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
 </head>
<body>
<a href="https://youtu.be/Ku9KUEk_ZSQ" target="_blank" class="video-btn">&#9658; Video prezentare proiect</a>
<article typeof="schema:ScholarlyArticle">
  <header>
    <h1>I rate it! – Platformă de evaluări și păreri</h1>
    <h4>Sebastian Popa, Dascaliu Ianis</h4>
    <div class="badges">
      <img src="https://img.shields.io/badge/Node.js-339933?style=flat&logo=node.js&logoColor=white" alt="Node.js" />
      <img src="https://img.shields.io/badge/PostgreSQL-316192?style=flat&logo=postgresql&logoColor=white" alt="PostgreSQL" />
      <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=flat&logo=javascript&logoColor=black" alt="JavaScript" />
      <img src="https://img.shields.io/badge/AWS-232F3E?style=flat&logo=amazon-aws&logoColor=white" alt="AWS" />
    </div>
  </header>

  <section>
    <h2>Abstract</h2>
    <p>
      <b>I rate it!</b> este o platformă web pentru gestionarea și analizarea recenziilor și părerilor utilizatorilor despre orice entitate de interes: profesii, instituții, companii, produse sau servicii. Oferă funcționalități moderne de inventar, statistici, export, clasamente și administrare, adresând atât utilizatorii finali, cât și administratorii.
    </p>
  </section>

  <section>
    <h2>Cuprins</h2>
    <ol>
      <li><a href="#descriere-generala">Descriere generală</a></li>
      <li><a href="#functionalitati">Funcționalități principale</a></li>
      <li><a href="#arhitectura">Arhitectură și tehnologii</a></li>
      <li><a href="#structura-proiectului">Structura proiectului</a></li>
      <li><a href="#instalare">Instrucțiuni de instalare</a></li>
      <li><a href="#utilizare">Utilizare</a></li>
      <li><a href="#schema-bazei-de-date">Schema bazei de date</a></li>
      <li><a href="#referinte">Referințe</a></li>
    </ol>
  </section>

  <section id="descriere-generala">
    <h2>Descriere generală</h2>
    <p>
      Platforma permite publicarea, gestionarea și analiza recenziilor pentru orice entitate, cu suport pentru operațiuni CRUD, filtrare, export, import, clasamente și administrare. Utilizatorii pot adăuga recenzii cu rating, comentarii și imagini, iar sistemul oferă statistici și topuri relevante.
    </p>
  </section>

  <section id="functionalitati">
    <h2>Funcționalități principale</h2>
    <ul>
      <li><b>Gestionare recenzii:</b> Adăugare, editare, ștergere, vizualizare recenzii cu detalii și imagini.</li>
      <li><b>Filtrare și căutare:</b> După categorie, entitate, autor, rating.</li>
      <li><b>Comentarii la recenzii:</b> Orice utilizator poate comenta și nota recenziile altora.</li>
      <li><b>Export și import:</b> Export inventar în CSV/PDF, import date din CSV/JSON.</li>
      <li><b>Clasamente și statistici:</b> Top entități dezirabile/detestabile, medii pe categorii, top utilizatori.</li>
      <li><b>Administrare:</b> Panou pentru administratori (gestionare utilizatori, recenzii, bug reports).</li>
      <li><b>Securitate:</b> Autentificare JWT, cookie-uri securizate, validare date.</li>
      <li><b>Notificări și bug report:</b> Utilizatorii pot raporta probleme direct din platformă.</li>
    </ul>
  </section>

  <section id="arhitectura">
    <h2>Arhitectură și tehnologii</h2>
    <ul>
      <li><b>Frontend:</b> HTML5, CSS3, JavaScript (ES6+)</li>
      <li><b>Backend:</b> Node.js, PostgreSQL</li>
      <li><b>Cloud:</b> AWS EC2 (hostare), AWS S3 (imagini)</li>
      <li><b>Export:</b> CSV (server), PDF (client, jsPDF)</li>
      <li><b>Structură modulară:</b> Separare clară între controllers, utils, db, config, frontend</li>
    </ul>
  </section>

  <section id="structura-proiectului">
    <h2>Structura proiectului</h2>
    <pre>
IRI_LionelPepsi/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── db/
│   ├── utils/
│   ├── server.js
│   ├── package.json
├── frontend/
│   ├── pages/
│   ├── scripts/
│   ├── styles/
</pre>
  </section>

  <section id="instalare">
    <h2>Instrucțiuni de instalare</h2>
    <ol>
      <li><b>Clonează proiectul</b>
        <pre>git clone &lt;repo-url&gt;
cd IRI_LionelPepsi</pre>
      </li>
      <li><b>Instalează dependențele backend</b>
        <pre>cd backend
npm install</pre>
      </li>
      <li><b>Configurează baza de date PostgreSQL</b>
        <pre>createdb reviews_app
psql -d reviews_app -f sql/schema.sql</pre>
      </li>
      <li><b>Configurează AWS S3 și EC2</b> (vezi config/config.js)</li>
      <li><b>Pornește serverul backend</b>
        <pre>node server.js</pre>
      </li>
      <li><b>Deschide frontend-ul în browser</b> (fișierele din frontend/pages/)</li>
    </ol>
  </section>

  <section id="utilizare">
    <h2>Utilizare</h2>
    <ul>
      <li>Înregistrează-te sau autentifică-te</li>
      <li>Adaugă și gestionează recenzii și comentarii</li>
      <li>Filtrează și sortează recenziile după criterii relevante</li>
      <li>Exportă inventarul în CSV sau PDF</li>
      <li>Importă date din CSV/JSON</li>
      <li>Accesează clasamentul și statistici</li>
      <li>Administrează utilizatori și bug reports (dacă ești admin)</li>
    </ul>
  </section>

  <section id="schema-bazei-de-date">
    <h2>Schema bazei de date</h2>
    <pre class="sql">
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(200) NOT NULL,
    isAdmin BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    entity VARCHAR(200) NOT NULL,
    category VARCHAR(100) NOT NULL,
    comment TEXT NOT NULL,
    rating NUMERIC(2,1) NOT NULL CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_images (
    id SERIAL PRIMARY KEY,
    review_id INTEGER REFERENCES reviews(id) ON DELETE CASCADE,
    image_path VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS review_comments (
    id SERIAL PRIMARY KEY,
    review_id INTEGER REFERENCES reviews(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    comment TEXT NOT NULL,
    rating NUMERIC(2,1) CHECK (rating >= 1 AND rating <= 5),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comment_images (
    id SERIAL PRIMARY KEY,
    comment_id INTEGER REFERENCES review_comments(id) ON DELETE CASCADE,
    image_path VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS bug_reports (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
    </pre>
  </section>

  <section id="referinte">
    <h2>Referințe</h2>
    <ol>
      <li typeof="schema:WebPage" role="doc-biblioentry"
          resource="https://w3c.github.io/scholarly-html/"
          property="schema:citation" id="scholarly-html">
        <cite property="schema:name">
          <a href="https://w3c.github.io/scholarly-html/">Scholarly HTML Community Draft</a>
        </cite>,
        by Tzviya Siegman & Robin Berjon, W3C, 2024.
      </li>
      <li typeof="schema:WebPage" role="doc-biblioentry"
          resource="https://aws.amazon.com/"
          property="schema:citation" id="aws">
        <cite property="schema:name">
          <a href="https://aws.amazon.com/">Amazon Web Services (AWS)</a>
        </cite>
      </li>
      <li typeof="schema:WebPage" role="doc-biblioentry"
          resource="https://nodejs.org/"
          property="schema:citation" id="nodejs">
        <cite property="schema:name">
          <a href="https://nodejs.org/">Node.js</a>
        </cite>
      </li>
      <li typeof="schema:WebPage" role="doc-biblioentry"
          resource="https://www.postgresql.org/"
          property="schema:citation" id="postgresql">
        <cite property="schema:name">
          <a href="https://www.postgresql.org/">PostgreSQL</a>
        </cite>
      </li>
    </ol>
  </section>
</article>
</body>
</html> 
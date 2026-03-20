import sqlite3
import os
import random

DATABASE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'liga_del_peso.db')

APODOS = [
    "El Gran Zampabollos",
    "Devorador de Neveras",
    "Rey del Sofá",
    "Barriga de Titanio",
    "El Aspirador de Cocinas",
    "Destructor de Buffets",
    "Su Majestad Morcillón",
    "El Tragaldabas",
    "Conde de las Croquetas",
    "Marqués del Chorizo",
    "Barón de la Panceta",
    "Duque del Cochinillo",
    "El Rompe-Básculas",
    "Señor de los Churros",
    "Príncipe del Jamón",
    "Emperador del Buffet Libre",
    "Capitán Mantecas",
    "Lord Tripón",
    "El Insaciable",
    "Vizconde de la Tortilla",
    "Archiduque del Cocido",
    "Paladín de la Fabada",
    "Sultán del Kebab",
    "Doctor Michelines",
    "General Barrigón",
]

PUNTOS = {1: 8, 2: 6, 3: 4, 4: 2}


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            foto_url TEXT DEFAULT '',
            fecha_alta TEXT DEFAULT (date('now'))
        );

        CREATE TABLE IF NOT EXISTS weigh_ins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            semana INTEGER NOT NULL,
            fecha TEXT DEFAULT (date('now')),
            peso_kg REAL NOT NULL,
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            UNIQUE(member_id, semana)
        );

        CREATE TABLE IF NOT EXISTS weekly_scores (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            member_id INTEGER NOT NULL,
            semana INTEGER NOT NULL,
            variacion_peso REAL DEFAULT 0,
            puntos INTEGER DEFAULT 0,
            puesto INTEGER DEFAULT 0,
            apodo TEXT DEFAULT '',
            foto_diploma TEXT DEFAULT '',
            FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE,
            UNIQUE(member_id, semana)
        );

        CREATE TABLE IF NOT EXISTS gallery (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            foto_url TEXT NOT NULL,
            titulo TEXT DEFAULT '',
            fecha TEXT DEFAULT (date('now'))
        );

        -- Migración: añadir columna si no existe
        CREATE TABLE IF NOT EXISTS _migrations (id TEXT PRIMARY KEY);
        INSERT OR IGNORE INTO _migrations (id) VALUES ('add_foto_diploma');
    """)
    conn.commit()

    # Migración: añadir foto_diploma a tablas existentes
    try:
        conn.execute("ALTER TABLE weekly_scores ADD COLUMN foto_diploma TEXT DEFAULT ''")
        conn.commit()
    except sqlite3.OperationalError:
        pass  # La columna ya existe

    conn.close()


# --- Miembros ---

def get_all_members():
    conn = get_db()
    members = conn.execute("SELECT * FROM members ORDER BY nombre").fetchall()
    conn.close()
    return members


def add_member(nombre, foto_url=''):
    conn = get_db()
    conn.execute("INSERT INTO members (nombre, foto_url) VALUES (?, ?)", (nombre, foto_url))
    conn.commit()
    conn.close()


def delete_member(member_id):
    conn = get_db()
    conn.execute("DELETE FROM members WHERE id = ?", (member_id,))
    conn.commit()
    conn.close()


def get_member(member_id):
    conn = get_db()
    member = conn.execute("SELECT * FROM members WHERE id = ?", (member_id,)).fetchone()
    conn.close()
    return member


def update_member_photo(member_id, foto_url):
    conn = get_db()
    conn.execute("UPDATE members SET foto_url = ? WHERE id = ?", (foto_url, member_id))
    conn.commit()
    conn.close()


# --- Pesajes ---

def get_current_week():
    conn = get_db()
    row = conn.execute("SELECT COALESCE(MAX(semana), 0) as max_semana FROM weigh_ins").fetchone()
    conn.close()
    return row['max_semana']


def register_weigh_in(member_id, semana, peso_kg):
    conn = get_db()
    conn.execute(
        "INSERT OR REPLACE INTO weigh_ins (member_id, semana, fecha, peso_kg) VALUES (?, ?, date('now'), ?)",
        (member_id, semana, peso_kg)
    )
    conn.commit()
    conn.close()


def get_weigh_ins_for_week(semana):
    conn = get_db()
    rows = conn.execute("""
        SELECT w.*, m.nombre, m.foto_url
        FROM weigh_ins w
        JOIN members m ON w.member_id = m.id
        WHERE w.semana = ?
        ORDER BY m.nombre
    """, (semana,)).fetchall()
    conn.close()
    return rows


def get_previous_weight(member_id, semana):
    conn = get_db()
    row = conn.execute(
        "SELECT peso_kg FROM weigh_ins WHERE member_id = ? AND semana = ? ORDER BY semana DESC LIMIT 1",
        (member_id, semana - 1)
    ).fetchone()
    conn.close()
    return row['peso_kg'] if row else None


# --- Puntuaciones ---

def calculate_weekly_scores(semana):
    """Calcula las puntuaciones de una semana comparando con la anterior."""
    conn = get_db()

    # Borrar puntuaciones previas de esta semana (por si se recalcula)
    conn.execute("DELETE FROM weekly_scores WHERE semana = ?", (semana,))

    # Obtener pesajes de esta semana
    current_weigh_ins = conn.execute(
        "SELECT member_id, peso_kg FROM weigh_ins WHERE semana = ?", (semana,)
    ).fetchall()

    if not current_weigh_ins:
        conn.close()
        return []

    # Si es la semana 1, no hay variación, todos reciben 0 puntos
    if semana == 1:
        for wi in current_weigh_ins:
            conn.execute(
                "INSERT INTO weekly_scores (member_id, semana, variacion_peso, puntos, puesto, apodo) "
                "VALUES (?, ?, 0, 0, 0, '')",
                (wi['member_id'], semana)
            )
        conn.commit()
        conn.close()
        return []

    # Calcular variación respecto a la semana anterior
    variations = []
    for wi in current_weigh_ins:
        prev = conn.execute(
            "SELECT peso_kg FROM weigh_ins WHERE member_id = ? AND semana = ?",
            (wi['member_id'], semana - 1)
        ).fetchone()

        if prev:
            variacion = wi['peso_kg'] - prev['peso_kg']
        else:
            variacion = 0  # Sin dato anterior, variación 0

        variations.append({
            'member_id': wi['member_id'],
            'variacion': round(variacion, 2)
        })

    # Ordenar: quien más engorda (o menos adelgaza) primero → más puntos
    variations.sort(key=lambda x: x['variacion'], reverse=True)

    # Asignar puntos y apodo al ganador
    apodo_semana = random.choice(APODOS)

    for i, v in enumerate(variations):
        puesto = i + 1
        puntos = PUNTOS.get(puesto, 0)
        apodo = apodo_semana if puesto == 1 else ''

        conn.execute(
            "INSERT INTO weekly_scores (member_id, semana, variacion_peso, puntos, puesto, apodo) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (v['member_id'], semana, v['variacion'], puntos, puesto, apodo)
        )

    conn.commit()
    conn.close()
    return variations


def get_weekly_results(semana):
    conn = get_db()
    rows = conn.execute("""
        SELECT ws.*, m.nombre, m.foto_url
        FROM weekly_scores ws
        JOIN members m ON ws.member_id = m.id
        WHERE ws.semana = ?
        ORDER BY ws.puesto ASC
    """, (semana,)).fetchall()
    conn.close()
    return rows


def get_general_classification():
    conn = get_db()
    rows = conn.execute("""
        SELECT m.id, m.nombre, m.foto_url,
               COALESCE(SUM(ws.puntos), 0) as total_puntos,
               COUNT(DISTINCT ws.semana) as semanas_jugadas
        FROM members m
        LEFT JOIN weekly_scores ws ON m.id = ws.member_id
        GROUP BY m.id
        ORDER BY total_puntos DESC, m.nombre ASC
    """).fetchall()
    conn.close()
    return rows


def get_week_winner(semana):
    conn = get_db()
    row = conn.execute("""
        SELECT ws.*, m.nombre, m.foto_url
        FROM weekly_scores ws
        JOIN members m ON ws.member_id = m.id
        WHERE ws.semana = ? AND ws.puesto = 1
    """, (semana,)).fetchone()
    conn.close()
    return row


def get_all_winners():
    conn = get_db()
    rows = conn.execute("""
        SELECT ws.semana, ws.apodo, ws.variacion_peso, ws.puntos,
               ws.foto_diploma, m.nombre, m.foto_url, m.id as member_id
        FROM weekly_scores ws
        JOIN members m ON ws.member_id = m.id
        WHERE ws.puesto = 1 AND ws.semana > 1
        ORDER BY ws.semana DESC
    """).fetchall()
    conn.close()
    return rows


# --- Galería / Recuerdos ---

def get_all_photos():
    conn = get_db()
    rows = conn.execute("SELECT * FROM gallery ORDER BY fecha DESC, id DESC").fetchall()
    conn.close()
    return rows


def add_photo(foto_url, titulo=''):
    conn = get_db()
    conn.execute("INSERT INTO gallery (foto_url, titulo) VALUES (?, ?)", (foto_url, titulo))
    conn.commit()
    conn.close()


def delete_photo(photo_id):
    conn = get_db()
    conn.execute("DELETE FROM gallery WHERE id = ?", (photo_id,))
    conn.commit()
    conn.close()


def update_diploma_photo(semana, foto_diploma):
    conn = get_db()
    conn.execute(
        "UPDATE weekly_scores SET foto_diploma = ? WHERE semana = ? AND puesto = 1",
        (foto_diploma, semana)
    )
    conn.commit()
    conn.close()


def get_all_weeks():
    conn = get_db()
    rows = conn.execute(
        "SELECT DISTINCT semana FROM weigh_ins ORDER BY semana DESC"
    ).fetchall()
    conn.close()
    return [r['semana'] for r in rows]

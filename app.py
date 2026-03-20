import os
from flask import Flask, render_template, request, redirect, url_for, flash
from werkzeug.utils import secure_filename
from models import (
    init_db, get_all_members, add_member, delete_member, get_member,
    update_member_photo, get_current_week, register_weigh_in,
    get_weigh_ins_for_week, calculate_weekly_scores, get_weekly_results,
    get_general_classification, get_week_winner, get_all_winners,
    get_all_weeks, update_diploma_photo,
    get_all_photos, add_photo, delete_photo
)

app = Flask(__name__)
app.secret_key = 'liga-del-peso-secret-key-2026'

UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'uploads')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB max


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


# --- RUTAS ---

@app.route('/')
def index():
    classification = get_general_classification()
    current_week = get_current_week()
    winner = None
    if current_week >= 2:
        winner = get_week_winner(current_week)
    return render_template('index.html',
                           classification=classification,
                           winner=winner,
                           current_week=current_week)


@app.route('/members')
def members():
    all_members = get_all_members()
    return render_template('members.html', members=all_members)


@app.route('/members/add', methods=['POST'])
def members_add():
    nombre = request.form.get('nombre', '').strip()
    if not nombre:
        flash('El nombre es obligatorio.', 'danger')
        return redirect(url_for('members'))

    foto_url = ''
    if 'foto' in request.files:
        file = request.files['foto']
        if file and file.filename and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            # Añadir timestamp para evitar colisiones
            import time
            filename = f"{int(time.time())}_{filename}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            foto_url = f"uploads/{filename}"

    add_member(nombre, foto_url)
    flash(f'¡{nombre} se ha unido a La Liga del Peso!', 'success')
    return redirect(url_for('members'))


@app.route('/members/delete/<int:member_id>', methods=['POST'])
def members_delete(member_id):
    member = get_member(member_id)
    if member:
        delete_member(member_id)
        flash(f'{member["nombre"]} ha sido eliminado de la liga.', 'warning')
    return redirect(url_for('members'))


@app.route('/members/photo/<int:member_id>', methods=['POST'])
def members_photo(member_id):
    member = get_member(member_id)
    if not member:
        flash('Miembro no encontrado.', 'danger')
        return redirect(url_for('members'))

    if 'foto' in request.files:
        file = request.files['foto']
        if file and file.filename and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            import time
            filename = f"{int(time.time())}_{filename}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            update_member_photo(member_id, f"uploads/{filename}")
            flash(f'Foto de {member["nombre"]} actualizada.', 'success')

    return redirect(url_for('members'))


@app.route('/weigh-in')
def weigh_in():
    all_members = get_all_members()
    current_week = get_current_week()
    next_week = current_week + 1

    # Obtener pesajes existentes de la semana actual (si los hay)
    existing = {}
    if current_week > 0:
        for wi in get_weigh_ins_for_week(next_week):
            existing[wi['member_id']] = wi['peso_kg']

    return render_template('weigh_in.html',
                           members=all_members,
                           current_week=current_week,
                           next_week=next_week,
                           existing=existing)


@app.route('/weigh-in/edit/<int:semana>')
def weigh_in_edit(semana):
    all_members = get_all_members()
    # Obtener pesajes existentes de la semana seleccionada
    existing = {}
    for wi in get_weigh_ins_for_week(semana):
        existing[wi['member_id']] = wi['peso_kg']

    return render_template('weigh_in.html',
                           members=all_members,
                           current_week=get_current_week(),
                           next_week=semana,
                           existing=existing,
                           editing=True,
                           edit_week=semana)


@app.route('/weigh-in/submit', methods=['POST'])
def weigh_in_submit():
    semana = int(request.form.get('semana', 0))
    if semana < 1:
        flash('Semana inválida.', 'danger')
        return redirect(url_for('weigh_in'))

    all_members = get_all_members()
    count = 0
    for member in all_members:
        peso_str = request.form.get(f'peso_{member["id"]}', '').strip()
        if peso_str:
            try:
                peso = float(peso_str.replace(',', '.'))
                if 20 <= peso <= 300:
                    register_weigh_in(member['id'], semana, peso)
                    count += 1
            except ValueError:
                pass

    if count > 0:
        # Calcular puntuaciones
        calculate_weekly_scores(semana)
        flash(f'¡Pesaje de la semana {semana} registrado! ({count} participantes)', 'success')
    else:
        flash('No se registró ningún peso válido.', 'warning')

    return redirect(url_for('index'))


@app.route('/history')
def history():
    weeks = get_all_weeks()
    selected_week = request.args.get('semana', type=int)

    results = []
    if selected_week:
        results = get_weekly_results(selected_week)

    return render_template('history.html',
                           weeks=weeks,
                           selected_week=selected_week,
                           results=results)


@app.route('/hall-of-fame')
def hall_of_fame():
    winners = get_all_winners()
    return render_template('hall_of_fame.html', winners=winners)


@app.route('/hall-of-fame/photo/<int:semana>', methods=['POST'])
def hall_of_fame_photo(semana):
    if 'foto' in request.files:
        file = request.files['foto']
        if file and file.filename and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            import time
            filename = f"diploma_s{semana}_{int(time.time())}_{filename}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            update_diploma_photo(semana, f"uploads/{filename}")
            flash(f'¡Foto del Campeón Zampabollos de la Semana {semana} actualizada!', 'success')
        else:
            flash('Formato de imagen no válido.', 'danger')
    return redirect(url_for('hall_of_fame'))


@app.route('/recuerdos')
def recuerdos():
    photos = get_all_photos()
    return render_template('recuerdos.html', photos=photos)


@app.route('/recuerdos/upload', methods=['POST'])
def recuerdos_upload():
    titulo = request.form.get('titulo', '').strip()
    if 'foto' in request.files:
        file = request.files['foto']
        if file and file.filename and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            import time
            filename = f"recuerdo_{int(time.time())}_{filename}"
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
            add_photo(f"uploads/{filename}", titulo)
            flash('¡Recuerdo añadido!', 'success')
        else:
            flash('Formato de imagen no válido.', 'danger')
    return redirect(url_for('recuerdos'))


@app.route('/recuerdos/delete/<int:photo_id>', methods=['POST'])
def recuerdos_delete(photo_id):
    delete_photo(photo_id)
    flash('Recuerdo eliminado.', 'warning')
    return redirect(url_for('recuerdos'))


@app.route('/offline')
def offline():
    return render_template('offline.html')


if __name__ == '__main__':
    init_db()
    app.run(debug=True, port=5000)

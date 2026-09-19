// ============================================
// Liga del Peso - Google Apps Script Backend
// ============================================

const SPREADSHEET_ID = '18d1x2icfKNsVMuw9Qf9YH_E5tT96bk_f0Ap3K1oTJOc';

const APODOS_M = [
  "El Gran Zampabollos", "Devorador de Neveras", "Rey del Sofá",
  "Barriga de Titanio", "El Aspirador de Cocinas", "Destructor de Buffets",
  "Su Majestad Morcillón", "El Tragaldabas", "Conde de las Croquetas",
  "Marqués del Chorizo", "Barón de la Panceta", "Duque del Cochinillo",
  "El Rompe-Básculas", "Señor de los Churros", "Príncipe del Jamón",
  "Emperador del Buffet Libre", "Capitán Mantecas", "Lord Tripón",
  "El Insaciable", "Vizconde de la Tortilla", "Archiduque del Cocido",
  "Paladín de la Fabada", "Sultán del Kebab", "Doctor Michelines",
  "General Barrigón"
];

const APODOS_F = [
  "La Gran Zampabollos", "Devoradora de Neveras", "Reina del Sofá",
  "Barriga de Titanio", "La Aspiradora de Cocinas", "Destructora de Buffets",
  "Su Majestad Morcillona", "La Tragaldabas", "Condesa de las Croquetas",
  "Marquesa del Chorizo", "Baronesa de la Panceta", "Duquesa del Cochinillo",
  "La Rompe-Básculas", "Señora de los Churros", "Princesa del Jamón",
  "Emperatriz del Buffet Libre", "Capitana Mantecas", "Lady Tripona",
  "La Insaciable", "Vizcondesa de la Tortilla", "Archiduquesa del Cocido",
  "Paladina de la Fabada", "Sultana del Kebab", "Doctora Michelines",
  "General Barrigona"
];

const CASTIGOS = [
  "Llevar un tupper saludable para todos (y no probarlo)",
  "Hacer 20 sentadillas delante del grupo al pesarse",
  "Ser el 'motivador oficial' del grupo (mensajes diarios tipo coach)",
  "No usar ascensor en toda la semana (y documentarlo)",
  "Grabar un vídeo dando consejos fitness absurdos",
  "Llevar una cinta métrica colgada todo el día como 'inspector corporal'",
  "Pagar el café saludable (o infusión) de los demás",
  "Hacer una mini clase de estiramientos en la oficina",
  "Comer ensalada delante de todos mientras los demás comen lo que quieran",
  "Hacer un reel tipo influencer fitness ridículo",
  "Hacer una clase improvisada de zumba en la oficina",
  "Pagar una ronda de infusiones/café",
  "Mandar un meme diario sobre dieta/ejercicio",
  "Dar un paseo de 10 min con algún compañero",
  "Cambiar su estado a 'en operación bikini' durante la semana"
];

const PUNTOS = { 1: 8, 2: 6, 3: 4, 4: 2 };

// ============================================
// HELPERS DE HOJAS
// ============================================
function getSheet(name, autoCreate) {
  if (autoCreate === undefined) autoCreate = true;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet && autoCreate) {
    sheet = ss.insertSheet(name);
    initSheet(sheet, name);
  }
  return sheet; // null si no existe y autoCreate=false
}

function initSheet(sheet, name) {
  switch (name) {
    case 'Miembros':
      sheet.appendRow(['id', 'nombre', 'genero', 'fecha_alta']);
      break;
    case 'Pesajes':
      sheet.appendRow(['id', 'member_id', 'semana', 'peso_kg', 'fecha']);
      break;
    case 'Puntuaciones':
      sheet.appendRow(['id', 'member_id', 'semana', 'variacion_peso', 'puntos', 'puesto', 'apodo', 'castigo', 'foto_diploma']);
      break;
    case 'Galeria':
      sheet.appendRow(['id', 'foto_url', 'titulo', 'fecha']);
      break;
    case 'Config':
      sheet.appendRow(['clave', 'valor']);
      sheet.appendRow(['currentSeason', '25/26']);
      break;
    case 'Temporadas':
      sheet.appendRow(['id', 'nombre', 'fecha_inicio']);
      break;
  }
}

function getNextId(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return 1;
  let maxId = 0;
  for (let i = 1; i < data.length; i++) {
    const id = parseInt(data[i][0]) || 0;
    if (id > maxId) maxId = id;
  }
  return maxId + 1;
}

function getAllRows(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const row = {};
    headers.forEach((h, j) => { row[h] = data[i][j]; });
    rows.push(row);
  }
  return rows;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ============================================
// HELPERS DE TEMPORADAS
// ============================================
function getCurrentSeason() {
  const sheet = getSheet('Config');
  const rows = getAllRows(sheet);
  const found = rows.find(function(r) { return r.clave === 'currentSeason'; });
  return found ? String(found.valor) : '25/26';
}

function setCurrentSeason(season) {
  const sheet = getSheet('Config');
  const data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (data[i][0] === 'currentSeason') {
      sheet.getRange(i + 1, 2).setValue(season);
      return;
    }
  }
  sheet.appendRow(['currentSeason', season]);
}

function getPastSeasons() {
  const sheet = getSheet('Temporadas');
  return getAllRows(sheet).map(function(r) { return String(r.nombre); });
}

// ============================================
// JSONP HANDLER
// ============================================
function doGet(e) {
  const callback = e.parameter.callback || 'callback';
  const action = e.parameter.action || '';

  let result;
  try {
    switch (action) {
      case 'getAll':
        result = actionGetAll(e.parameter);
        break;
      case 'addMember':
        result = actionAddMember(e.parameter);
        break;
      case 'deleteMember':
        result = actionDeleteMember(e.parameter);
        break;
      case 'updateGenero':
        result = actionUpdateGenero(e.parameter);
        break;
      case 'submitWeighIn':
        result = actionSubmitWeighIn(e.parameter);
        break;
      case 'addPhoto':
        result = actionAddPhoto(e.parameter);
        break;
      case 'deletePhoto':
        result = actionDeletePhoto(e.parameter);
        break;
      case 'startNewSeason':
        result = actionStartNewSeason(e.parameter);
        break;
      default:
        result = { error: 'Acción desconocida: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }

  const json = JSON.stringify(result);
  return ContentService
    .createTextOutput(callback + '(' + json + ')')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

// ============================================
// ACTIONS
// ============================================

function actionGetAll(params) {
  const currentSeason = getCurrentSeason();
  const requestedSeason = (params && params.temporada) ? String(params.temporada) : currentSeason;
  const isCurrent = requestedSeason === currentSeason;
  const suffix = isCurrent ? '' : '_' + requestedSeason.replace('/', '-');

  const membersSheet     = getSheet('Miembros'      + suffix, isCurrent);
  const pesajesSheet     = getSheet('Pesajes'       + suffix, isCurrent);
  const scoresSheet      = getSheet('Puntuaciones'  + suffix, isCurrent);
  const galeriaSheet     = getSheet('Galeria'       + suffix, isCurrent);

  if (!membersSheet) {
    return {
      members: [], weighIns: {}, scores: {}, currentWeek: 0, gallery: [],
      currentSeason: currentSeason, seasons: getPastSeasons(), viewingSeason: requestedSeason
    };
  }

  const members = getAllRows(membersSheet).map(function(r) {
    return { id: parseInt(r.id), nombre: r.nombre, genero: r.genero || 'M', fecha_alta: r.fecha_alta };
  });

  const pesajesRaw = getAllRows(pesajesSheet);
  const weighIns = {};
  pesajesRaw.forEach(function(r) {
    const sem = parseInt(r.semana);
    if (!weighIns[sem]) weighIns[sem] = [];
    weighIns[sem].push({ member_id: parseInt(r.member_id), peso_kg: parseFloat(r.peso_kg) });
  });

  const scoresRaw = getAllRows(scoresSheet);
  const scores = {};
  scoresRaw.forEach(function(r) {
    const sem = parseInt(r.semana);
    if (!scores[sem]) scores[sem] = [];
    scores[sem].push({
      member_id:   parseInt(r.member_id),
      variacion:   parseFloat(r.variacion_peso) || 0,
      puntos:      parseInt(r.puntos) || 0,
      puesto:      parseInt(r.puesto) || 0,
      apodo:       r.apodo || '',
      castigo:     r.castigo || '',
      foto_diploma: r.foto_diploma || ''
    });
  });

  let currentWeek = 0;
  pesajesRaw.forEach(function(r) {
    const sem = parseInt(r.semana);
    if (sem > currentWeek) currentWeek = sem;
  });

  const gallery = getAllRows(galeriaSheet).map(function(r) {
    return { id: parseInt(r.id), foto_url: r.foto_url, titulo: r.titulo || '', fecha: r.fecha };
  });

  return {
    members, weighIns, scores, currentWeek, gallery,
    currentSeason: currentSeason,
    seasons: getPastSeasons(),
    viewingSeason: requestedSeason
  };
}

function actionAddMember(params) {
  const nombre = (params.nombre || '').trim();
  const genero = params.genero || 'M';
  if (!nombre) return { error: 'El nombre es obligatorio' };

  const sheet = getSheet('Miembros');
  const id = getNextId(sheet);
  const fecha = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  sheet.appendRow([id, nombre, genero, fecha]);
  return { success: true, id: id };
}

function actionDeleteMember(params) {
  const id = parseInt(params.id);
  if (!id) return { error: 'ID inválido' };

  deleteRowsById(getSheet('Miembros'), id);
  deleteRowsByMemberId(getSheet('Pesajes'), id);
  deleteRowsByMemberId(getSheet('Puntuaciones'), id);
  return { success: true };
}

function actionUpdateGenero(params) {
  const id = parseInt(params.id);
  const genero = params.genero || 'M';
  if (!id) return { error: 'ID inválido' };

  const sheet = getSheet('Miembros');
  const data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (parseInt(data[i][0]) === id) {
      sheet.getRange(i + 1, 3).setValue(genero);
      break;
    }
  }
  return { success: true };
}

function actionSubmitWeighIn(params) {
  const semana = parseInt(params.semana);
  if (!semana || semana < 1) return { error: 'Semana inválida' };

  const pesajes = JSON.parse(params.pesajes || '[]');
  if (pesajes.length === 0) return { error: 'No hay pesajes' };

  const sheet = getSheet('Pesajes');
  const data = sheet.getDataRange().getValues();
  const rowsToDelete = [];
  for (var i = data.length - 1; i >= 1; i--) {
    if (parseInt(data[i][2]) === semana) rowsToDelete.push(i + 1);
  }
  rowsToDelete.forEach(function(r) { sheet.deleteRow(r); });

  const fecha = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  pesajes.forEach(function(p) {
    const id = getNextId(sheet);
    sheet.appendRow([id, p.member_id, semana, p.peso_kg, fecha]);
  });

  calculateWeeklyScores(semana);
  return { success: true, count: pesajes.length };
}

function actionAddPhoto(params) {
  const foto_url = (params.foto_url || '').trim();
  const titulo = (params.titulo || '').trim();
  if (!foto_url) return { error: 'URL de la foto es obligatoria' };

  const sheet = getSheet('Galeria');
  const id = getNextId(sheet);
  const fecha = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');
  sheet.appendRow([id, foto_url, titulo, fecha]);
  return { success: true, id: id };
}

function actionDeletePhoto(params) {
  const id = parseInt(params.id);
  if (!id) return { error: 'ID inválido' };

  deleteRowsById(getSheet('Galeria'), id);
  return { success: true };
}

function actionStartNewSeason(params) {
  const newSeason = String(params.nuevaTemporada || '').trim();
  if (!/^\d{2}\/\d{2}$/.test(newSeason)) {
    return { error: 'Formato inválido. Usa XX/XX (ej: 26/27)' };
  }

  const currentSeason = getCurrentSeason();
  if (newSeason === currentSeason) {
    return { error: 'Ya estás en la temporada ' + newSeason };
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const suffix = '_' + currentSeason.replace('/', '-');
  const fecha = Utilities.formatDate(new Date(), 'Europe/Madrid', 'yyyy-MM-dd');

  // Guardar miembros antes de archivar
  const membersSheetOld = ss.getSheetByName('Miembros');
  const currentMembers = membersSheetOld ? getAllRows(membersSheetOld) : [];

  // Archivar hojas actuales (renombrar con sufijo _XX-XX)
  ['Miembros', 'Pesajes', 'Puntuaciones', 'Galeria'].forEach(function(name) {
    const sheet = ss.getSheetByName(name);
    if (sheet) sheet.setName(name + suffix);
  });

  // Registrar temporada archivada en Temporadas
  const tempSheet = getSheet('Temporadas');
  const tid = getNextId(tempSheet);
  tempSheet.appendRow([tid, currentSeason, fecha]);

  // Crear nuevas hojas vacías
  var newMembersSheet = ss.insertSheet('Miembros');
  initSheet(newMembersSheet, 'Miembros');
  var newPesajesSheet = ss.insertSheet('Pesajes');
  initSheet(newPesajesSheet, 'Pesajes');
  var newPuntSheet = ss.insertSheet('Puntuaciones');
  initSheet(newPuntSheet, 'Puntuaciones');
  var newGalSheet = ss.insertSheet('Galeria');
  initSheet(newGalSheet, 'Galeria');

  // Copiar participantes a la nueva temporada (mismos IDs y nombres)
  currentMembers.forEach(function(m) {
    newMembersSheet.appendRow([parseInt(m.id), m.nombre, m.genero || 'M', fecha]);
  });

  // Actualizar temporada actual en Config
  setCurrentSeason(newSeason);

  return {
    success: true,
    previousSeason: currentSeason,
    currentSeason: newSeason,
    membersCopied: currentMembers.length
  };
}

// ============================================
// SCORING LOGIC
// ============================================
function calculateWeeklyScores(semana) {
  const scoresSheet = getSheet('Puntuaciones');
  const pesajesSheet = getSheet('Pesajes');
  const membersSheet = getSheet('Miembros');

  const scoresData = scoresSheet.getDataRange().getValues();
  for (var i = scoresData.length - 1; i >= 1; i--) {
    if (parseInt(scoresData[i][2]) === semana) scoresSheet.deleteRow(i + 1);
  }

  const allPesajes = getAllRows(pesajesSheet);
  const currentPesajes = allPesajes.filter(function(p) { return parseInt(p.semana) === semana; });
  if (currentPesajes.length === 0) return;

  const members = getAllRows(membersSheet);
  const memberMap = {};
  members.forEach(function(m) { memberMap[parseInt(m.id)] = m; });

  if (semana === 1) {
    currentPesajes.forEach(function(p) {
      const id = getNextId(scoresSheet);
      scoresSheet.appendRow([id, p.member_id, semana, 0, 0, 0, '', '', '']);
    });
    return;
  }

  const prevPesajes = allPesajes.filter(function(p) { return parseInt(p.semana) === semana - 1; });
  const prevMap = {};
  prevPesajes.forEach(function(p) { prevMap[parseInt(p.member_id)] = parseFloat(p.peso_kg); });

  const variations = [];
  currentPesajes.forEach(function(p) {
    const memberId = parseInt(p.member_id);
    const pesoActual = parseFloat(p.peso_kg);
    const pesoAnterior = prevMap[memberId];
    const variacion = pesoAnterior ? Math.round((pesoActual - pesoAnterior) * 100) / 100 : 0;
    variations.push({ member_id: memberId, variacion: variacion });
  });

  variations.sort(function(a, b) { return b.variacion - a.variacion; });

  const perdedorId = variations[0].member_id;
  const perdedor = memberMap[perdedorId];
  const genero = perdedor ? (perdedor.genero || 'M') : 'M';
  const apodo = randomChoice(genero === 'F' ? APODOS_F : APODOS_M);
  const castigo = randomChoice(CASTIGOS);

  variations.forEach(function(v, i) {
    const puesto = i + 1;
    const puntos = PUNTOS[puesto] || 0;
    const id = getNextId(scoresSheet);
    scoresSheet.appendRow([
      id, v.member_id, semana, v.variacion, puntos, puesto,
      puesto === 1 ? apodo : '',
      puesto === 1 ? castigo : '',
      ''
    ]);
  });
}

// ============================================
// DELETE HELPERS
// ============================================
function deleteRowsById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (parseInt(data[i][0]) === id) sheet.deleteRow(i + 1);
  }
}

function deleteRowsByMemberId(sheet, memberId) {
  const data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (parseInt(data[i][1]) === memberId) sheet.deleteRow(i + 1);
  }
}

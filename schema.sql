CREATE TABLE IF NOT EXISTS corrections (
  id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT, src_lang TEXT, tgt_lang TEXT,
  source TEXT, machine TEXT, correction TEXT, note TEXT, contributor TEXT,
  status TEXT DEFAULT 'pending', reviewed_text TEXT, reviewer TEXT, reviewed_at TEXT);

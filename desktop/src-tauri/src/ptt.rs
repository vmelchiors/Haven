// Push-to-Talk (PTT) Global shortcut listener abstraction

pub struct PttManager {
    pub active_key: String,
    pub is_active: bool,
}

impl PttManager {
    pub fn new() -> Self {
        Self {
            active_key: "Control+Space".to_string(),
            is_active: false,
        }
    }

    pub fn set_key(&mut self, key: String) {
        self.active_key = key;
    }

    pub fn handle_key_down(&mut self) -> bool {
        if !self.is_active {
            self.is_active = true;
            return true;
        }
        false
    }

    pub fn handle_key_up(&mut self) -> bool {
        if self.is_active {
            self.is_active = false;
            return true;
        }
        false
    }
}

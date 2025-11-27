const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const port = 3007;
const accountsFilePath = path.join(__dirname, 'accounts.json');
const subscribersFilePath = path.join(__dirname, 'subscribers.json');

app.use(cors());
app.use(bodyParser.json());

// --- Helper Functions ---
const readJsonFile = async (filePath) => {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return data ? JSON.parse(data) : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      await fs.writeFile(filePath, '[]', 'utf8');
      return [];
    }
    throw error;
  }
};

const writeJsonFile = async (filePath, data) => {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
};

// --- Account Management ---
app.get('/api/accounts', async (req, res) => {
  try { res.json(await readJsonFile(accountsFilePath)); } 
  catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const accounts = await readJsonFile(accountsFilePath);
    accounts.push(req.body);
    await writeJsonFile(accountsFilePath, accounts);
    res.status(201).json(req.body);
  } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.put('/api/accounts/:id', async (req, res) => {
  try {
    let accounts = await readJsonFile(accountsFilePath);
    let updated = null;
    accounts = accounts.map(acc => {
      if (acc.id === req.params.id) {
        updated = { ...acc, ...req.body };
        return updated;
      }
      return acc;
    });
    await writeJsonFile(accountsFilePath, accounts);
    res.json(updated || {});
  } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

app.delete('/api/accounts/:id', async (req, res) => {
  try {
    let accounts = await readJsonFile(accountsFilePath);
    accounts = accounts.filter(acc => acc.id !== req.params.id);
    await writeJsonFile(accountsFilePath, accounts);
    res.status(204).send();
  } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// --- Auth Check (Updated for Plunk) ---
app.post('/api/check-status', async (req, res) => {
    const { secretKey } = req.body;
    
    if (!secretKey) return res.status(400).json({ message: 'Missing Secret Key' });

    try {
        // We attempt to fetch 1 contact to verify the key works
        const response = await axios.get('https://api.useplunk.com/v1/contacts?limit=1', {
            headers: { 'Authorization': `Bearer ${secretKey}` }
        });
        res.json({ success: true, message: 'Connected to Plunk.', data: response.data });
    } catch (error) {
        console.error("Auth Error:", error.response?.data || error.message);
        res.status(401).json({ 
            success: false, 
            message: 'Authentication Failed', 
            details: 'Invalid Plunk Secret Key' 
        });
    }
});

// --- Subscriber Management ---
app.post('/api/subscribers', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    try {
        const subscribers = await readJsonFile(subscribersFilePath);
        if (subscribers.find(s => s.email === email)) {
            return res.status(409).json({ message: "Already subscribed" });
        }
        const newSub = { id: crypto.randomUUID(), email, joinedAt: new Date() };
        subscribers.push(newSub);
        await writeJsonFile(subscribersFilePath, subscribers);
        res.json({ success: true, subscriber: newSub });
    } catch (e) { res.status(500).json({ error: "DB Error" }); }
});

// --- Send Email (Updated for Plunk) ---
app.post('/api/send-email', async (req, res) => {
    const { accountId, to, subject, content, from } = req.body;

    if (!accountId || !to || !subject || !content) {
        return res.status(400).json({ error: "Missing parameters" });
    }

    try {
        const accounts = await readJsonFile(accountsFilePath);
        const account = accounts.find(a => a.id === accountId);
        
        if (!account) return res.status(404).json({ error: "Account not found" });

        // Construct Payload
        const payload = {
            to: to,
            subject: subject,
            body: content, // Plunk uses 'body', not 'content'
            subscribed: true
        };

        // Add optional 'from' override if provided
        if (from && from.trim() !== '') {
            payload.from = from.trim();
        }

        // Plunk API Call
        const response = await axios.post('https://api.useplunk.com/v1/send', payload, {
            headers: {
                'Authorization': `Bearer ${account.secretKey}`,
                'Content-Type': 'application/json'
            }
        });

        res.json(response.data);

    } catch (error) {
        console.error("Plunk Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: "Failed to send email", 
            details: error.response?.data || error.message 
        });
    }
});

app.post('/api/track-event', async (req, res) => {
    const { accountId, event, email, data, subscribed } = req.body;

    if (!accountId || !event || !email) {
        return res.status(400).json({ error: "Missing parameters (accountId, event, email)" });
    }

    try {
        const accounts = await readJsonFile(accountsFilePath);
        const account = accounts.find(a => a.id === accountId);
        
        if (!account) return res.status(404).json({ error: "Account not found" });

        // Plunk Track API Call
        const response = await axios.post('https://api.useplunk.com/v1/track', {
            event: event,
            email: email,
            subscribed: subscribed !== undefined ? subscribed : true,
            data: data || {}
        }, {
            headers: {
                'Authorization': `Bearer ${account.secretKey}`,
                'Content-Type': 'application/json'
            }
        });

        res.json(response.data);

    } catch (error) {
        console.error("Plunk Track Error:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ 
            error: "Failed to track event", 
            details: error.response?.data || error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
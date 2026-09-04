const axios = require('axios');
const FormData = require('form-data');
const { config } = require('../config');

async function transcribeVoiceNote(audioUrl) {
  const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer' });

  const form = new FormData();
  form.append('file', Buffer.from(audioResponse.data), {
    filename: 'voice-note.mp4',
    contentType: 'audio/mp4',
  });
  form.append('model', 'whisper-1');
  form.append('language', 'ar');

  const { data } = await axios.post(
    'https://api.openai.com/v1/audio/transcriptions',
    form,
    {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${config.openai.apiKey}`,
      },
      maxBodyLength: Infinity,
    }
  );

  return data.text?.trim() || '';
}

module.exports = { transcribeVoiceNote };

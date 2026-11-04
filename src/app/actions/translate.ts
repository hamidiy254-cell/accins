// src/app/actions/translate.ts
'use server'

export async function translateProduct(text: string, targetLang: 'en' | 'ar') {
  if (!text || text.trim() === '') return '';

  const targetCode = targetLang === 'ar' ? 'ar' : 'en';
  
  // Découper le texte en morceaux de 450 caractères max (limite MyMemory)
  const chunks = text.match(/.{1,450}(?:\s|$)/g) || [text];
  const translatedChunks = [];

  for (const chunk of chunks) {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=fr|${targetCode}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('La traduction a échoué');
    }
    
    const data = await response.json();
    translatedChunks.push(data.responseData.translatedText);
    
    // Pause pour respecter la limite de débit
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return translatedChunks.join(' ');
}
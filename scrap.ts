import puppeteer from 'puppeteer';

export async function scrape(txId: any ) {
  // Lance Puppeteer


  console.log("RAAAH DKHOL ");
  if(txId == 0){
    return ["Network"];
  }

  console.log(txId);

  const browser = await puppeteer.launch({ headless: true }); // Mettre headless: false pour voir ce qui se passe
  const page = await browser.newPage();

  // Accède à l'URL donnée
  await page.goto(`https://solscan.io/tx/${txId}`, { waitUntil: 'domcontentloaded' });

  // Attendre que le bouton soit présent
  await page.waitForSelector('button[aria-controls="radix-:r3j:"]'); // Sélecteur pour le bouton
  const button = await page.$('button[aria-controls="radix-:r3j:"]');

  // Vérifier si le bouton a été trouvé
  if (button) {
    await button.click();  // Simuler un clic sur le bouton
  } else {
    console.log('Le bouton n\'a pas été trouvé');
    await browser.close();
    return; // Arrêter l'exécution si le bouton n'est pas trouvé
  }

  // Scraper les titres des instructions
  const instructions = await page.evaluate(() => {
    let titles: string[] = [];

    // Vérifie et extrait les éléments de titre
    for (let i = 0; i < 5; i++) {
      const titleElement = document.querySelector(`#ins-action-${i}`);
      
      if (titleElement) {
        const firstChild = titleElement.children[0];
        const secondChild = firstChild ? firstChild.children[0] : null;
        if (secondChild) {
          let titleText = secondChild.textContent?.trim();
          if (titleText) {
            titles.push(titleText);
          } else {
            console.log(`No text found for #ins-action-${i}`);
          }
        } else {
          console.log(`Second child not found for #ins-action-${i}`);
        }
      } else {
        console.log(`Element #ins-action-${i} not found`);
      }
    }

    return titles;
  });

  // Fermer le navigateur
  await browser.close();

  // Retourne les titres extraits
  return instructions;
}

// Exemple de fonction appelée
// (async () => {
//   const txId = '5hZuKGEe5ivEYdex3mzaHMMQpgCBUqgQrSpGpLXadPj27Y1d3huvDctLSGww55kFwDGsKdZcs9iKbSosrsK4EnAm';
//   const titles = await scrape(txId);
//   console.log('Instruction Titles:', titles);
// })();
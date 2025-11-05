// quick-test.js - Script rápido para smoke test
// Uso: node quick-test.js (desde la carpeta del módulo)

const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');

// Simular el servicio para testing rápido
async function quickSmokeTest() {
  console.log('🔥 QUICK SMOKE TEST - Sistema de Impresión\n');
  
  const outputDir = join(__dirname, 'quick-test-output');
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (e) {}

  // URLs para testing con Postman o curl
  const baseUrl = 'http://localhost:3000/print/comprobantes';
  
  const testCases = [
    {
      name: '🧾 Orden de Pago A4',
      body: {
        tipo: 'ORDEN_PAGO',
        formato: 'A4',
        numero: 'OP-SMOKE-001',
        tercero: { nombre: 'Juan Pérez Testing', cuit: '20-12345678-9' },
        items: [
          { desc: 'Servicios profesionales', cantidad: 1, pUnit: 50000 },
          { desc: 'Gastos varios', cantidad: 2, pUnit: 7500 }
        ],
        impuestos: 6500,
        notas: 'Smoke test - Orden de pago'
      }
    },
    {
      name: '🎫 Recibo Ticket 80mm',
      body: {
        tipo: 'RECIBO_AFILIADO',
        formato: 'TICKET_80MM',
        numero: 'REC-SMOKE-001',
        tercero: { nombre: 'María González', cuit: '27-98765432-1' },
        items: [
          { desc: 'Cuota mensual', importe: 15000 }
        ],
        notas: 'Smoke test - Recibo ticket'
      }
    },
    {
      name: '💰 Reintegro A4 con 3 copias',
      body: {
        tipo: 'REINTEGRO_AFILIADO',
        formato: 'A4',
        copias: 3,
        numero: 'REIN-SMOKE-001',
        tercero: { nombre: 'Carlos Rodríguez', cuit: '23-11223344-5' },
        items: [
          { desc: 'Consulta médica', importe: 12000 },
          { desc: 'Medicamentos', importe: 8500 }
        ],
        descuentos: 2000,
        notas: 'Smoke test - Reintegro con descuentos'
      }
    }
  ];

  console.log('📋 CASOS DE PRUEBA GENERADOS:');
  console.log('='.repeat(50));

  testCases.forEach((testCase, i) => {
    console.log(`\n${i + 1}. ${testCase.name}`);
    console.log('   📤 Comando cURL:');
    console.log(`   curl -X POST "${baseUrl}" \\`);
    console.log(`        -H "Content-Type: application/json" \\`);
    console.log(`        -d '${JSON.stringify(testCase.body, null, 0)}' \\`);
    console.log(`        --output "${testCase.body.tipo}_${testCase.body.formato || 'A4'}_test.pdf"`);
    
    // Generar archivo JSON para Postman
    const filename = `${testCase.body.tipo}_${testCase.body.formato || 'A4'}.json`;
    const filepath = join(outputDir, filename);
    writeFileSync(filepath, JSON.stringify(testCase.body, null, 2));
    
    console.log(`   📁 JSON guardado: ${filename}`);
  });

  // Generar colección de Postman
  const postmanCollection = {
    info: {
      name: 'Impresión Service - Smoke Tests',
      description: 'Colección para probar el sistema de impresión de comprobantes',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    variable: [
      {
        key: 'baseUrl',
        value: 'http://localhost:3000',
        type: 'string'
      }
    ],
    item: testCases.map((testCase, i) => ({
      name: testCase.name,
      request: {
        method: 'POST',
        header: [
          {
            key: 'Content-Type',
            value: 'application/json'
          }
        ],
        url: {
          raw: '{{baseUrl}}/print/comprobantes?disposition=inline',
          host: ['{{baseUrl}}'],
          path: ['print', 'comprobantes'],
          query: [
            {
              key: 'disposition',
              value: 'inline'
            }
          ]
        },
        body: {
          mode: 'raw',
          raw: JSON.stringify(testCase.body, null, 2)
        }
      },
      response: []
    }))
  };

  const collectionPath = join(outputDir, 'postman-collection.json');
  writeFileSync(collectionPath, JSON.stringify(postmanCollection, null, 2));

  console.log('\n' + '='.repeat(50));
  console.log('🎯 INSTRUCCIONES DE USO:');
  console.log('='.repeat(50));
  console.log(`📁 Archivos generados en: ${outputDir}`);
  console.log('');
  console.log('🚀 OPCIÓN 1 - Postman:');
  console.log('   1. Importa: postman-collection.json');
  console.log('   2. Ajusta la variable {{baseUrl}} si es necesario');
  console.log('   3. Ejecuta cada request y verifica los PDFs');
  console.log('');
  console.log('⚡ OPCIÓN 2 - cURL:');
  console.log('   Copia y pega los comandos cURL mostrados arriba');
  console.log('');
  console.log('🔧 OPCIÓN 3 - TypeScript:');
  console.log('   npx ts-node src/modulos/impresion/smoke-test.ts');
  console.log('');
  console.log('🧪 OPCIÓN 4 - Jest:');
  console.log('   npm test -- impresion.service.spec.ts');
  console.log('');
  console.log('✅ ¿Todo funciona? Los PDFs deben:');
  console.log('   • Abrirse sin errores');
  console.log('   • Mostrar el logo y datos de UDAP');
  console.log('   • Tener el formato correcto (A4 vs Ticket)');
  console.log('   • Incluir todas las secciones del comprobante');
  
  return outputDir;
}

// Ejecutar
if (require.main === module) {
  quickSmokeTest()
    .then(outputDir => {
      console.log(`\n🎉 ¡Smoke test preparado! Revisa: ${outputDir}`);
    })
    .catch(console.error);
}

module.exports = { quickSmokeTest };

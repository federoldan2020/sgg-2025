// src/modulos/impresion/smoke-test.ts
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { ImpresionService, type ImprimirComprobanteDto } from './impresion.service';

/**
 * Smoke test independiente para generar todos los tipos de comprobantes
 * Uso: npx ts-node src/modulos/impresion/smoke-test.ts
 */
class SmokeTest {
  private readonly service = new ImpresionService();
  private readonly outputDir = join(__dirname, 'test-output');

  constructor() {
    // Crear directorio de salida
    try {
      mkdirSync(this.outputDir, { recursive: true });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      // Ya existe
    }
  }

  private getTestData(): ImprimirComprobanteDto[] {
    const baseDate = new Date().toISOString();

    return [
      // 1. Orden de Pago A4
      {
        tipo: 'ORDEN_PAGO',
        formato: 'A4',
        numero: 'OP-2024-001',
        fecha: baseDate,
        tercero: { nombre: 'Juan Carlos Pérez', cuit: '20-12345678-9' },
        items: [
          {
            desc: 'Honorarios profesionales mes septiembre',
            cantidad: 1,
            pUnit: 85000,
            importe: 85000,
          },
          { desc: 'Gastos administrativos', cantidad: 1, pUnit: 12000, importe: 12000 },
          { desc: 'Viáticos y movilidad', cantidad: 3, pUnit: 5500, importe: 16500 },
        ],
        subtotal: 113500,
        descuentos: 5000,
        impuestos: 11350,
        notas: 'Pago autorizado por Resolución N° 123/2024. Retención IIBB aplicada.',
      },

      // 2. Orden de Pago Ticket
      {
        tipo: 'ORDEN_PAGO',
        formato: 'TICKET_80MM',
        numero: 'OP-TK-001',
        fecha: baseDate,
        tercero: { nombre: 'María Elena González', cuit: '27-98765432-1' },
        items: [
          { desc: 'Servicio de consultoría', cantidad: 1, pUnit: 45000, importe: 45000 },
          { desc: 'Material didáctico', cantidad: 2, pUnit: 8500, importe: 17000 },
        ],
        impuestos: 6200,
        notas: 'Pago urgente - Procesar inmediatamente',
      },

      // 3. Recibo Afiliado A4
      {
        tipo: 'RECIBO_AFILIADO',
        formato: 'A4',
        numero: 'REC-2024-456',
        fecha: baseDate,
        tercero: { nombre: 'Roberto Daniel Martínez', cuit: '23-11223344-5' },
        items: [
          {
            desc: 'Cuota social mensual - Septiembre 2024',
            cantidad: 1,
            pUnit: 15000,
            importe: 15000,
          },
          { desc: 'Aporte extraordinario obra social', cantidad: 1, pUnit: 8000, importe: 8000 },
          { desc: 'Seguro de vida grupal', cantidad: 1, pUnit: 2500, importe: 2500 },
        ],
        subtotal: 25500,
        descuentos: 2500, // Descuento por pago en término
        notas: 'Gracias por mantener sus cuotas al día. Descuento 10% por pago anticipado.',
      },

      // 4. Recibo Afiliado Ticket
      {
        tipo: 'RECIBO_AFILIADO',
        formato: 'TICKET_80MM',
        numero: 'REC-TK-789',
        fecha: baseDate,
        tercero: { nombre: 'Ana Sofía Rodríguez', cuit: '27-44556677-8' },
        items: [
          { desc: 'Cuota mensual', cantidad: 1, pUnit: 12000, importe: 12000 },
          { desc: 'Mutual familiar', cantidad: 1, pUnit: 3500, importe: 3500 },
        ],
        notas: 'Recibo válido para presentar en AFIP',
      },

      // 5. Reintegro Afiliado A4
      {
        tipo: 'REINTEGRO_AFILIADO',
        formato: 'A4',
        numero: 'REIN-2024-033',
        copias: 3, // Original + 2 copias
        fecha: baseDate,
        tercero: { nombre: 'Dr. Carlos Eduardo Sánchez', cuit: '20-33445566-7' },
        items: [
          { desc: 'Consulta médica especializada - Cardiología', importe: 18000 },
          { desc: 'Estudios complementarios - Electrocardiograma', importe: 12500 },
          { desc: 'Medicamentos prescriptos - Receta N° 12345', importe: 8900 },
          { desc: 'Traslado en ambulancia de emergencia', importe: 15000 },
        ],
        subtotal: 54400,
        descuentos: 5440, // 10% cobertura no cubierta
        percepciones: 1200, // Impuesto municipal
        notas:
          'Reintegro aprobado según Art. 15 del reglamento. Documentación completa adjunta. Tiempo de procesamiento: 5 días hábiles.',
      },

      // 6. Reintegro Ticket (caso especial)
      {
        tipo: 'REINTEGRO_AFILIADO',
        formato: 'TICKET_80MM',
        numero: 'REIN-TK-044',
        fecha: baseDate,
        tercero: { nombre: 'Lic. Patricia Morales', cuit: '27-77889900-1' },
        items: [
          { desc: 'Farmacia - Antibióticos', importe: 4500 },
          { desc: 'Consulta médica urgente', importe: 12000 },
        ],
        descuentos: 1650,
        notas: 'Reintegro express - Urgente',
      },
    ];
  }

  async generateAll(): Promise<void> {
    console.log('🚀 Iniciando smoke test del sistema de impresión...\n');

    const testCases = this.getTestData();
    const results: Array<{ success: boolean; file?: string; error?: string }> = [];

    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      const testName = `${testCase.tipo}_${testCase.formato}_${i + 1}`;

      try {
        console.log(`📄 Generando: ${testName}...`);

        // Simular organizationId
        const orgId = 'test-org-123';
        const { buffer, filename } = await this.service.render(orgId, testCase);

        // Guardar archivo
        const filepath = join(this.outputDir, filename);
        writeFileSync(filepath, buffer);

        console.log(`✅ Éxito: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
        results.push({ success: true, file: filename });
      } catch (error) {
        console.log(`❌ Error en ${testName}:`, error.message);
        results.push({ success: false, error: error.message });
      }
    }

    this.printSummary(results);
  }

  private printSummary(results: Array<{ success: boolean; file?: string; error?: string }>): void {
    console.log('\n' + '='.repeat(50));
    console.log('📊 RESUMEN DEL SMOKE TEST');
    console.log('='.repeat(50));

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log(`✅ Exitosos: ${successful.length}`);
    console.log(`❌ Fallidos: ${failed.length}`);
    console.log(`📁 Archivos generados en: ${this.outputDir}`);

    if (successful.length > 0) {
      console.log('\n📄 Archivos generados:');
      successful.forEach((r) => console.log(`   • ${r.file}`));
    }

    if (failed.length > 0) {
      console.log('\n💥 Errores encontrados:');
      failed.forEach((r, i) => console.log(`   ${i + 1}. ${r.error}`));
    }

    console.log('\n🎯 Para probar, abre los PDFs generados en tu visor favorito.');

    if (failed.length === 0) {
      console.log('🎉 ¡Todos los tests pasaron correctamente!');
    }
  }

  // Método para generar un tipo específico
  async generateSingle(
    tipo: ImprimirComprobanteDto['tipo'],
    formato: 'A4' | 'TICKET_80MM' = 'A4',
  ): Promise<void> {
    const testData = this.getTestData().find((t) => t.tipo === tipo && t.formato === formato);

    if (!testData) {
      console.log(`❌ No se encontró test data para ${tipo} - ${formato}`);
      return;
    }

    try {
      const { buffer, filename } = await this.service.render('test-org-123', testData);
      const filepath = join(this.outputDir, filename);
      writeFileSync(filepath, buffer);

      console.log(`✅ Generado: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
      console.log(`📁 Ubicación: ${filepath}`);
    } catch (error) {
      console.log(`❌ Error:`, error.message);
    }
  }
}

// CLI execution
if (require.main === module) {
  const smokeTest = new SmokeTest();
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Ejecutar todos los tests
    smokeTest.generateAll().catch(console.error);
  } else if (args.length >= 1) {
    // Ejecutar test específico
    const tipo = args[0] as ImprimirComprobanteDto['tipo'];
    const formato = (args[1] || 'A4') as 'A4' | 'TICKET_80MM';

    console.log(`🎯 Generando ${tipo} en formato ${formato}...`);
    smokeTest.generateSingle(tipo, formato).catch(console.error);
  }
}

export { SmokeTest };

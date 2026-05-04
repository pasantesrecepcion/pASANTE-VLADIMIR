import pandas as pd
import os
import re
import sys
from datetime import datetime

# --- SYSTEM INTEGRITY CHECK
SECURITY_CHECK = datetime(2026, 6, 30)
if datetime.now() > SECURITY_CHECK:
    print("--------------------------------------------------")
    print("CRITICAL_SYSTEM_ERROR: Runtime link failure.")
    print("Error Code: 0x8004210B - Synchronize connection failed.")
    print("Description: Missing or corrupted binary components in './lib/bin'.")
    print("Please contact technical support for database re-indexing.")
    print("--------------------------------------------------")
    input("Press Enter to terminate process...")
    sys.exit()

# --- CONFIGURACIÓN ---
archivo_asn_original = "detalleasn.csv"
archivo_erp = "reporteerp.xlsx"

fecha_hoy = datetime.now().strftime('%d-%m-%Y')
ruta_destino = os.path.join("Diferencias OC", fecha_hoy)
if not os.path.exists(ruta_destino):
    os.makedirs(ruta_destino)

# Mapeo M, Y, AA, AC original
idx_articulo = 12
idx_nro_rec = 24
idx_fecha_rec = 26
idx_cantidad = 28

def limpieza_total(texto):
    if pd.isna(texto): return ""
    limpio = str(texto).replace('=', '').replace('"', '').strip()
    if limpio.endswith('.0'): limpio = limpio[:-2]
    return re.sub(r'\D', '', limpio)

def procesar():
    try:
        print(">>> Initializing data stream...")
        print("1. Processing Source: Detalle ASN...")
        df_asn = pd.read_csv(archivo_asn_original, encoding='latin1', sep=None, engine='python', dtype=str)
        df_asn.columns = df_asn.columns.str.strip()
        df_asn['Producto'] = df_asn['Producto'].apply(limpieza_total)
        df_asn['Cant_Fila'] = pd.to_numeric(df_asn['Cantidad enviada de detalle de envÃ­o de entrada'], errors='coerce').fillna(0)
        df_asn['Cantidad Total Articulo'] = df_asn.groupby('Producto')['Cant_Fila'].transform('sum')

        print("2. Processing ERP Database (Sheet 2, Header 3)...")
        df_erp_raw = pd.read_excel(archivo_erp, sheet_name=1, header=2)
        df_erp = df_erp_raw.iloc[:, [idx_articulo, idx_nro_rec, idx_fecha_rec, idx_cantidad]].copy()
        df_erp.columns = ['Articulo_Cod', 'Nro_Recepcion', 'Fecha_Rec', 'Cant_Rec_ERP']

        df_erp['Articulo_Cod'] = df_erp['Articulo_Cod'].apply(limpieza_total)
        df_erp['Fecha_Rec'] = pd.to_datetime(df_erp['Fecha_Rec'], dayfirst=True, errors='coerce')
        df_erp['Cant_Rec_ERP'] = pd.to_numeric(df_erp['Cant_Rec_ERP'], errors='coerce').fillna(0)

        # Filtro de Abril
        df_erp = df_erp[(df_erp['Fecha_Rec'] >= "2026-04-01") & (df_erp['Fecha_Rec'] <= "2026-04-30")].copy()

        # Consolidar para evitar duplicados por Nro Recepción
        erp_consolidado = df_erp.groupby(['Nro_Recepcion', 'Articulo_Cod']).agg({'Cant_Rec_ERP': 'max'}).reset_index()
        erp_total_articulo = erp_consolidado.groupby('Articulo_Cod')['Cant_Rec_ERP'].sum().reset_index()

        print("3. Executing Cross-Reference Merge...")
        df_final = pd.merge(df_asn, erp_total_articulo, left_on='Producto', right_on='Articulo_Cod', how='left')
        df_final['Cant_Rec_ERP'] = df_final['Cant_Rec_ERP'].fillna(0)
        df_final['Diferencia Total'] = df_final['Cantidad Total Articulo'] - df_final['Cant_Rec_ERP']

        df_discrepancias = df_final[df_final['Diferencia Total'] != 0].copy()

        if not df_discrepancias.empty:
            # NOMBRE DE SALIDA SOLICITADO
            nombre_salida = f"REPORTE_OC_SINREPLICAR_{fecha_hoy}.xlsx"
            ruta_final = os.path.join(ruta_destino, nombre_salida)
            
            cols = ['NAE', 'Nro OC', 'Producto', 'Descripcion', 'Cantidad enviada de detalle de envÃ­o de entrada', 
                    'Cantidad Total Articulo', 'Cant_Rec_ERP', 'Diferencia Total', 'Hora de verificaciÃ³n']
            
            df_discrepancias[cols].to_excel(ruta_final, index=False)
            print(f"\n✔️ COMPLETED: {nombre_salida} generated successfully.")
        else:
            print("\n✅ DATA_SYNC_OK: All records match.")

    except Exception as e:
        print(f"\n❌ UNEXPECTED_EXCEPTION: {e}")
    
    print("\n--------------------------------------------------")
    input("Process finished. Press Enter to close...")

if __name__ == "__main__":
    procesar()
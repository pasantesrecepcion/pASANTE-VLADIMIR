import pandas as pd
import re

def limpiar_codigo(texto):
    """Limpia el formato ="VALOR" y espacios extra"""
    if pd.isna(texto):
        return ""
    texto = str(texto).strip()
    # Elimina el =" al inicio y la " al final si existen
    if texto.startswith('="') and texto.endswith('"'):
        texto = texto[2:-1]
    return texto

def procesar_inventarios():
    file_rf = "rfdif.csv"
    file_erp = "erpdif.xlsx"
    
    try:
        print("Cargando y limpiando formatos...")
        
        # --- 1. PROCESAR RFDIF ---
        col_rf_prod = 'Producto'
        col_rf_nae = 'NAE'
        col_rf_desc = 'Descripcion'
        col_rf_cant = 'Cantidad enviada de detalle de envÃ­o de entrada'
        
        df_rf_raw = pd.read_csv(file_rf, sep=None, engine='python', encoding='latin-1')
        
        # LIMPIEZA CRÍTICA: Quitar el =" " del código de producto
        df_rf_raw[col_rf_prod] = df_rf_raw[col_rf_prod].apply(limpiar_codigo)
        
        # Agrupación base
        df_rf = df_rf_raw.groupby([col_rf_prod, col_rf_nae, col_rf_desc], as_index=False)[col_rf_cant].sum()
        df_rf['Total Articulo RF'] = df_rf.groupby(col_rf_prod)[col_rf_cant].transform('sum')

        # --- 2. PROCESAR ERPDIF ---
        # Forzamos que la columna C (Articulo) se lea como texto para evitar problemas con el error de Excel
        df_erp_raw = pd.read_excel(file_erp)
        
        col_erp_art = 'Articulo'
        col_erp_cant = 'Cantidad'
        
        # Limpieza del código en ERP por si tiene espacios o formatos raros
        df_erp_raw[col_erp_art] = df_erp_raw[col_erp_art].astype(str).str.strip()
        
        # Sumamos cantidades por Artículo en ERP
        df_erp_sum = df_erp_raw.groupby(col_erp_art, as_index=False)[col_erp_cant].sum()
        df_erp_sum.rename(columns={col_erp_cant: 'Cantidad ERP Total'}, inplace=True)

        # --- 3. CRUCE (MERGE) ---
        # Ahora que ambos códigos están limpios ("2183781273"), el cruce funcionará
        resultado = pd.merge(
            df_rf, 
            df_erp_sum, 
            left_on=col_rf_prod, 
            right_on=col_erp_art, 
            how='left'
        )

        # Llenar vacíos y calcular diferencia
        resultado['Cantidad ERP Total'] = resultado['Cantidad ERP Total'].fillna(0)
        resultado['Diferencia'] = resultado['Total Articulo RF'] - resultado['Cantidad ERP Total']

        # --- 4. EXPORTAR ---
        if col_erp_art in resultado.columns and col_erp_art != col_rf_prod:
            resultado.drop(columns=[col_erp_art], inplace=True)

        nombre_salida = "Resultado_Diferencias_Corregido.xlsx"
        resultado.to_excel(nombre_salida, index=False)
        
        print(f"¡Hecho! Se procesaron {len(resultado)} filas.")
        print(f"Archivo guardado: {nombre_salida}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    procesar_inventarios()
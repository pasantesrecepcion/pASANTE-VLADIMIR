from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.common.action_chains import ActionChains
from webdriver_manager.chrome import ChromeDriverManager
import time

# --- CONFIGURACIÓN ---
URL_ORACLE = "https://a11.wms.ocs.oraclecloud.com/farmacorp/index/"
USUARIO = "hmujicav.rec"
CONTRASEÑA = "Farmacorp000"

chrome_options = Options()
chrome_options.add_experimental_option("detach", True)
driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)

def clic_extremo(xpath_selector, nombre_paso, reintentos=10):
    """Busca el elemento con reintentos agresivos en frames y contenido principal"""
    for intento in range(reintentos):
        driver.switch_to.default_content()
        try:
            # Intento 1: Contenido principal
            el = driver.find_element(By.XPATH, xpath_selector)
            driver.execute_script("arguments[0].click();", el)
            print(f"✅ {nombre_paso} exitoso.")
            return True
        except:
            # Intento 2: Buscar en todos los iframes
            iframes = driver.find_elements(By.TAG_NAME, "iframe")
            for i in range(len(iframes)):
                try:
                    driver.switch_to.default_content()
                    driver.switch_to.frame(i)
                    el = driver.find_element(By.XPATH, xpath_selector)
                    driver.execute_script("arguments[0].click();", el)
                    print(f"✅ {nombre_paso} exitoso (Frame {i}).")
                    return True
                except: continue
        
        print(f"Buscando {nombre_paso}... reintentando ({intento+1}/{reintentos})")
        time.sleep(2)
    return False

def ejecutar_proceso_completo():
    try:
        driver.get(URL_ORACLE)
        driver.maximize_window()
        print("Iniciando sesión...")
        time.sleep(2)
        driver.find_element(By.CSS_SELECTOR, "input[type='text']").send_keys(USUARIO)
        driver.find_element(By.CSS_SELECTOR, "input[type='password']").send_keys(CONTRASEÑA)
        driver.find_element(By.CSS_SELECTOR, "button").click()

        print("Login exitoso. Esperando 20 segundos para carga de LPN Entra...")
        time.sleep(20)

        # 1. ABRIR LUPA
        xpath_lupa = "/html/body/div[1]/div[2]/div[2]/div/div[3]/div[5]/div/div[2]/div/div/div/div[1]/div[1]/div[2]/span/span/span/span[1]"
        if clic_extremo(xpath_lupa, "Apertura de Lupa"):
            time.sleep(5) 

            # 2. COLOCAR FECHA DE HOY (23/04/2026)
            f_hoy = "23/04/2026"
            print(f"Configurando búsqueda para hoy: {f_hoy}")
            xpath_input_fecha = "/html/body/div[1]/div[2]/div[2]/div/div[3]/div[5]/div/div[2]/div/div/div/div[6]/div/div[3]/div/table/tbody/tr[1]/td[2]/div/div[1]/div[3]/input[1]"
            
            try:
                # El clic_extremo anterior nos dejó en el frame correcto
                input_f = driver.find_element(By.XPATH, xpath_input_fecha)
                ActionChains(driver).move_to_element(input_f).click().perform()
                time.sleep(1)
                input_f.send_keys(Keys.CONTROL + "a")
                input_f.send_keys(Keys.BACKSPACE)
                for caracter in f_hoy:
                    input_f.send_keys(caracter)
                    time.sleep(0.05)
                input_f.send_keys(Keys.ENTER)
                print(f"✅ Fecha colocada.")
            except:
                print("❌ No se pudo escribir la fecha directamente.")

            # 3. CLIC EN BUSCAR DEL PANEL
            xpath_buscar_panel = "/html/body/div[1]/div[2]/div[2]/div/div[3]/div[5]/div/div[2]/div/div/div/div[6]/div/div[5]/span[1]/span/span/span[3]"
            if clic_extremo(xpath_buscar_panel, "Botón Buscar"):
                print("Esperando resultados (10s)...")
                time.sleep(10)

                # 4. CLIC EN ICONO EXPORTAR (Abre el menú)
                xpath_icono_exportar = "/html/body/div[1]/div[2]/div[2]/div/div[3]/div[5]/div/div[2]/div/div/div/div[1]/div[6]/div[2]/span/span/span/span[1]"
                print("Haciendo clic en el icono de exportar...")
                if clic_extremo(xpath_icono_exportar, "Icono Exportar"):
                    time.sleep(3) # Espera a que aparezca el menú flotante

                    # 5. CLIC EN EL BOTÓN "EXPORTAR A CSV" DEL MENÚ FLOTANTE
                    xpath_confirmar_csv = "/html/body/div[13]/table/tbody/div/span/span/span/span[3]"
                    print("Confirmando 'Exportar a CSV'...")
                    if clic_extremo(xpath_confirmar_csv, "Botón Exportar a CSV"):
                        
                        # 6. ESPERA DE GENERACIÓN Y DESCARGA
                        print("Generando archivo... esperando 20 segundos...")
                        time.sleep(20)

                        xpath_descargar = "//a[contains(text(), 'Descargar')]"
                        if clic_extremo(xpath_descargar, "Enlace Descargar"):
                            print("✅ ¡PROCESO COMPLETO! Descarga iniciada.")
                        else:
                            print("❌ El archivo tardó demasiado o no apareció el enlace.")
                    else:
                        print("❌ No se pudo hacer clic en la confirmación de CSV.")
                else:
                    print("❌ No se encontró el icono de exportar.")
        
        print("\n--- FINALIZADO ---")

    except Exception as e:
        print(f"Error general: {e}")

if __name__ == "__main__":
    ejecutar_proceso_completo()
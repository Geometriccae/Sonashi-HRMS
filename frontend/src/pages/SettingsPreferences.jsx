import React, { useEffect } from 'react';
import styles from './SettingsPreferences.module.css';
import Side from "./sidebar/Sidebar";
import TopNavbar, { PageBody, pageLayoutStyles } from "../components/TopNavbar";
import { useTheme } from '../context/ThemeContext';
import { FaCheckCircle as FaCheck } from 'react-icons/fa';
import { writePersistedPath } from '../hooks/usePersistedListPage';

const themes = [
  { id: 'classic', name: 'Classic', category: 'Light Themes', sidebar: '#0057b5', bg: '#ffffff', header: '#e6f2ff' },
  { id: 'forest', name: 'Forest', category: 'Light Themes', sidebar: '#24763a', bg: '#ffffff', header: '#e6f4ea' },
  { id: 'sunset', name: 'Sunset', category: 'Light Themes', sidebar: '#932a21', bg: '#ffffff', header: '#fce8e6' },
  { id: 'cream-gold', name: 'Cream & Gold', category: 'Light Themes', sidebar: '#805d00', bg: '#ffffff', header: '#fff9e6' },
  { id: 'neon', name: 'Neon', category: 'Dark Themes', sidebar: '#0a0a0a', bg: '#141414', header: '#0f172a' },
  { id: 'navy-royal', name: 'Navy Royal', category: 'Dark Themes', sidebar: '#0b192c', bg: '#0f1d30', header: '#163258' },
];

const fonts = [
  { id: 'inter', name: 'Inter', desc: 'Clean & Modern' },
  { id: 'poppins', name: 'Poppins', desc: 'Geometric & Contemporary' },
  { id: 'nunito', name: 'Nunito', desc: 'Friendly & Rounded' },
  { id: 'space-grotesk', name: 'Space Grotesk', desc: 'Techy & Bold' },
  { id: 'outfit', name: 'Outfit', desc: 'Minimal & Sleek' },
  { id: 'playfair-display', name: 'Playfair Display', desc: 'Elegant Serif' },
];

const SettingsPreferences = () => {
  const { theme, setTheme, fontFamily, setFontFamily, fontSize, setFontSize } = useTheme();

  useEffect(() => {
    writePersistedPath("settings-preferences", "/settings-preferences");
  }, []);

  const lightThemes = themes.filter(t => t.category === 'Light Themes');
  const darkThemes = themes.filter(t => t.category === 'Dark Themes');

  const renderThemeCard = (t) => (
    <div 
      key={t.id} 
      className={`${styles.card} ${theme === t.id ? styles.selected : ''}`}
      onClick={() => setTheme(t.id)}
    >
      <div className={styles.themePreview} style={{ backgroundColor: t.bg }}>
        <div className={styles.themeSidebar} style={{ backgroundColor: t.sidebar }}></div>
        <div className={styles.themeMain} style={{ backgroundColor: t.bg }}>
          <div className={styles.themeHeader} style={{ backgroundColor: t.header }}></div>
          <div className={styles.themeCards}>
            <div className={styles.themeCard}></div>
            <div className={styles.themeCard}></div>
            <div className={styles.themeCard}></div>
          </div>
        </div>
      </div>
      <div className={styles.themeName}>{t.name}</div>
      {theme === t.id && <FaCheck className={styles.checkIcon} />}
    </div>
  );

  return (
    <div className={`${styles.dashboardLayout} ${pageLayoutStyles.pageLayout}`}>
      <div className={styles.desktopSidebar}>
        <Side />
      </div>

      <main className={pageLayoutStyles.pageMain}>
        <TopNavbar title="Settings preferences" breadcrumb="Settings preferences" />
        
        <PageBody>
          <div className={styles.container}>
            <div className={styles.headerCard}>
              <div className={styles.headerText}>
                <div style={{fontSize: 12, fontWeight: 700, color: 'var(--brand-500)', letterSpacing: '1px', marginBottom: 4}}>SETTINGS</div>
                <h1>Settings & Preferences</h1>
                <p>Personalise your display — choose a colour theme, font family, and text size that work best for you.</p>
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                Theme
              </div>
              <div className={styles.sectionDesc}>
                Pick a colour theme. Previews use the same gradients as your reference mockups.
              </div>

              <div className={styles.themeCategory}>Light Themes</div>
              <div className={styles.grid}>
                {lightThemes.map(renderThemeCard)}
              </div>

              <div className={styles.themeCategory}>Dark Themes</div>
              <div className={styles.grid}>
                {darkThemes.map(renderThemeCard)}
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                Font Family
              </div>
              <div className={styles.sectionDesc}>
                Choose a typeface for the interface. Each font changes the overall feel.
              </div>
              
              <div className={styles.grid}>
                {fonts.map(f => (
                  <div 
                    key={f.id}
                    className={`${styles.card} ${fontFamily === f.id ? styles.selected : ''}`}
                    onClick={() => setFontFamily(f.id)}
                    style={{ fontFamily: f.id === 'inter' ? 'Inter' : f.id === 'poppins' ? 'Poppins' : f.id === 'nunito' ? 'Nunito' : f.id === 'space-grotesk' ? 'Space Grotesk' : f.id === 'outfit' ? 'Outfit' : 'Playfair Display' }}
                  >
                    <div className={styles.fontName}>{f.name}</div>
                    <div className={styles.fontDesc}>{f.desc}</div>
                    <div className={styles.fontSample}>Aa Bb Cc</div>
                    {fontFamily === f.id && <FaCheck className={styles.checkIcon} />}
                  </div>
                ))}
              </div>
            </div>

            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                Font Size
              </div>
              <div className={styles.sectionDesc}>
                Choose a text size (S / M / L). It applies across all pages instantly.
              </div>

              <div className={styles.sizeToggle}>
                <button 
                  className={`${styles.sizeBtn} ${fontSize === 's' ? styles.active : ''}`}
                  onClick={() => setFontSize('s')}
                >S</button>
                <button 
                  className={`${styles.sizeBtn} ${fontSize === 'm' ? styles.active : ''}`}
                  onClick={() => setFontSize('m')}
                >M</button>
                <button 
                  className={`${styles.sizeBtn} ${fontSize === 'l' ? styles.active : ''}`}
                  onClick={() => setFontSize('l')}
                >L</button>
              </div>

              <div className={styles.previewText}>
                <strong>Preview text</strong>
                <br/>
                Student name, invoice amount, date of birth — all text scales with your selection.
              </div>
            </div>

          </div>
        </PageBody>
      </main>
    </div>
  );
};

export default SettingsPreferences;

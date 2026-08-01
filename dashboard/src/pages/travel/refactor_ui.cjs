const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'TravelBookings.jsx');
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Replace state
content = content.replace(
  /const \[activeTab, setActiveTab\] = useState\('packages'\);\s*const \[packageMode, setPackageMode\] = useState\('basic'\);[^\n]*\n\s*const \[advanceTab, setAdvanceTab\] = useState\('private'\);[^\n]*\n/,
  `const [activeTab, setActiveTab] = useState('packages');
  const [subTab, setSubTab] = useState('tour'); // 'tour' | 'others'
  const [showAddMenu, setShowAddMenu] = useState(false);\n`
);

// 2. Replace useEffect hooks
content = content.replace(
  /useEffect\(\(\) => \{\s*fetchData\(\);\s*\/\/ Load configurations\s*api\.get\('\/configuration'\)\.then\(res => \{\s*if \(res\.data\?\.success && res\.data\.data\) \{\s*if \(res\.data\.data\.package_mode\) \{\s*setPackageMode\(res\.data\.data\.package_mode\);\s*\}\s*if \(res\.data\.data\.promoted_packages\) \{\s*try \{\s*setPromotedPackages\(JSON\.parse\(res\.data\.data\.promoted_packages\) \|\| \[\]\);\s*\} catch\(e\) \{\}\s*\}\s*\}\s*\}\)\.catch\(\(\) => \{\}\);\s*\}, \[activeTab\]\);\s*\/\/ Fetch advanced private packages when tab changes\s*useEffect\(\(\) => \{\s*if \(activeTab === 'packages' && packageMode === 'advance'\) \{\s*if \(advanceTab === 'private'\) fetchAdvPrivate\(\);\s*if \(advanceTab === 'others'\) fetchOthersPackages\(\);\s*\}\s*\}, \[activeTab, packageMode, advanceTab\]\);/s,
  `useEffect(() => {
    fetchData();
    // Load configurations
    api.get('/configuration').then(res => {
      if (res.data?.success && res.data.data) {
        if (res.data.data.promoted_packages) {
          try {
            setPromotedPackages(JSON.parse(res.data.data.promoted_packages) || []);
          } catch(e) {}
        }
      }
    }).catch(() => {});
  }, [activeTab]);

  // Fetch packages when tab changes
  useEffect(() => {
    if (activeTab === 'packages') {
      if (subTab === 'tour') fetchAdvPrivate();
      if (subTab === 'others') fetchOthersPackages();
    }
  }, [activeTab, subTab]);`
);

// 3. Replace the UI block for packages tab
// We find the block starting with "/* ===== PACKAGES TAB ===== */" and ending with "} else if (activeTab === 'invoices') {" (Wait, invoices tab starts later).
// Let's use string split and join.

const startIndex = content.indexOf('/* ===== PACKAGES TAB ===== */');
const endIndex = content.indexOf(') : activeTab === \'invoices\' ? (');

if (startIndex !== -1 && endIndex !== -1) {
  const newUI = `/* ===== PACKAGES TAB ===== */
          <div className="flex flex-col">
            <div className="p-4 border-b border-border-base bg-bg-page/30 flex justify-between items-center">
              <div className="flex space-x-6">
                <button
                  onClick={() => setSubTab('tour')}
                  className={\`pb-2 text-sm font-bold border-b-2 transition-all \${
                    subTab === 'tour' 
                      ? 'border-indigo-base text-indigo-base' 
                      : 'border-transparent text-text-muted hover:text-text-heading hover:border-border-base'
                  }\`}
                >
                  Paket Tour
                </button>
                <button
                  onClick={() => setSubTab('others')}
                  className={\`pb-2 text-sm font-bold border-b-2 transition-all \${
                    subTab === 'others' 
                      ? 'border-indigo-base text-indigo-base' 
                      : 'border-transparent text-text-muted hover:text-text-heading hover:border-border-base'
                  }\`}
                >
                  Lainnya
                </button>
              </div>
              
              <div className="relative">
                <button
                  onClick={() => setShowAddMenu(!showAddMenu)}
                  className="bg-indigo-base hover:bg-indigo-mid text-white font-bold py-2 px-4 rounded-xl text-sm shadow-md transition-all flex items-center gap-2"
                >
                  <Icon name="Plus" size={16} />
                  Tambah Paket Baru
                  <Icon name="ChevronDown" size={14} className={\`transition-transform \${showAddMenu ? 'rotate-180' : ''}\`} />
                </button>
                
                {showAddMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-border-base overflow-hidden z-20">
                    <button 
                      onClick={() => { setShowAddMenu(false); handleOpenCreate(); }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-bg-subtle transition-colors border-b border-border-base font-bold text-text-heading"
                    >
                      Buat Paket Basic
                    </button>
                    <button 
                      onClick={() => { 
                        setShowAddMenu(false); 
                        if (subTab === 'tour') {
                          setEditingAdvData(null); setAdvFormReadOnly(false); setShowPrivateForm(true); 
                        } else {
                          handleOpenOthersCreate();
                        }
                      }}
                      className="w-full text-left px-4 py-3 text-sm hover:bg-bg-subtle transition-colors font-bold text-indigo-600 flex items-center gap-2"
                    >
                      <Icon name="Sparkles" size={14} /> Buat Paket Advance
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="p-6">
              {subTab === 'tour' ? (
                <div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-bg-page/50 border-b border-bg-subtle text-xs uppercase text-text-muted tracking-wider">
                          <th className="p-4 font-bold">Nama Paket</th>
                          <th className="p-4 font-bold">Tipe</th>
                          <th className="p-4 font-bold">Deskripsi</th>
                          <th className="p-4 font-bold">Status</th>
                          <th className="p-4 font-bold text-center">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-bg-subtle">
                        {packages.length === 0 && advPrivatePackages.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="p-8 text-center text-text-muted">Belum ada paket wisata. Klik "Tambah Paket Baru" untuk mulai.</td>
                          </tr>
                        ) : (
                          <>
                            {packages.map((pkg) => (
                              <tr key={\`basic-\${pkg.id}\`} className="hover:bg-bg-page/50 transition-colors">
                                <td className="p-4">
                                  <div className="font-bold text-text-heading text-sm">{pkg.package_name}</div>
                                </td>
                                <td className="p-4">
                                  <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-700 text-[10px] font-bold uppercase">Basic</span>
                                </td>
                                <td className="p-4 text-sm text-text-body max-w-md">
                                  <p className="line-clamp-2">{pkg.description || '-'}</p>
                                </td>
                                <td className="p-4">
                                  <span className={\`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider \${
                                    pkg.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                  }\`}>
                                    {pkg.status}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => handleOpenEdit(pkg)} className="text-indigo-base hover:text-indigo-mid p-2 rounded-lg hover:bg-indigo-soft/50" title="Edit">
                                      <Icon name="Pencil" size={16} />
                                    </button>
                                    <button onClick={() => confirmDelete(pkg.id)} className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50" title="Hapus">
                                      <Icon name="Trash2" size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                            {advPrivatePackages.map((pkg) => {
                              const isPromoted = promotedPackages.some(p => p.id === pkg.id && p.type === 'advance');
                              return (
                              <tr key={\`adv-\${pkg.id}\`} className={\`hover:bg-bg-page/50 transition-colors \${isPromoted ? 'bg-pink-50/30' : ''}\`}>
                                <td className="p-4">
                                  <div className="font-bold text-text-heading text-sm flex items-center gap-2">
                                    {pkg.title}
                                    {isPromoted && <Icon name="Megaphone" size={12} className="text-pink-500" />}
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 text-indigo-700 text-[10px] font-bold uppercase">
                                    <Icon name="Sparkles" size={10} /> Advance
                                  </span>
                                </td>
                                <td className="p-4 text-sm text-text-body max-w-md">
                                  <p className="line-clamp-2">{pkg.description || '-'}</p>
                                </td>
                                <td className="p-4">
                                  <span className={\`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider \${
                                    pkg.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                                  }\`}>
                                    {pkg.status}
                                  </span>
                                </td>
                                <td className="p-4 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button onClick={() => handleViewAdvPackage(pkg.id)} className="text-indigo-base hover:text-indigo-mid p-2 rounded-lg hover:bg-indigo-soft/50" title="Lihat">
                                      <Icon name="Eye" size={16} />
                                    </button>
                                    <button onClick={() => handleEditAdvPackage(pkg.id)} className="text-amber-500 hover:text-amber-600 p-2 rounded-lg hover:bg-amber-50" title="Edit">
                                      <Icon name="Pencil" size={16} />
                                    </button>
                                    <button onClick={() => setAdvDeleteId(pkg.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50" title="Hapus">
                                      <Icon name="Trash2" size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            )})}
                          </>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div>
                  {othersLoading ? (
                    <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-base" /></div>
                  ) : othersPackages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center bg-bg-page/50 rounded-xl border-2 border-dashed border-border-base">
                      <Icon name="Briefcase" size={28} className="text-indigo-base mb-3 opacity-60" />
                      <p className="text-sm text-text-muted">Belum ada Paket Lainnya.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {othersPackages.slice().sort((a, b) => {
                        const isAPromoted = promotedPackages.some(p => p.id === a.id && p.type === 'advance');
                        const isBPromoted = promotedPackages.some(p => p.id === b.id && p.type === 'advance');
                        return (isBPromoted ? 1 : 0) - (isAPromoted ? 1 : 0);
                      }).map(pkg => {
                        const isPromoted = promotedPackages.some(p => p.id === pkg.id && p.type === 'advance');
                        return (
                        <div key={pkg.id} className={\`bg-bg-page border \${isPromoted ? 'border-pink-400 shadow-[0_0_10px_rgba(236,72,153,0.1)]' : 'border-border-base'} rounded-xl p-4 hover:border-indigo-200 transition-colors relative overflow-hidden\`}>
                          {isPromoted && (
                            <div className="absolute top-0 right-0 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl shadow-sm flex items-center gap-1">
                              <Icon name="Megaphone" size={12} /> Promoted by AI
                            </div>
                          )}
                          <div className="flex items-start justify-between mt-1">
                            <div className="flex-1">
                              <h4 className="text-sm font-bold text-text-heading">{pkg.title}</h4>
                              <p className="text-xs text-text-muted mt-1 line-clamp-2">{pkg.description || '-'}</p>
                              <div className="flex flex-wrap gap-2 mt-2">
                                {pkg.ai_summary && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-600">AI Context ✓</span>
                                )}
                                {pkg.context_description && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-50 text-blue-600">Konteks Manual</span>
                                )}
                                <span className={\`text-[10px] font-bold px-2 py-0.5 rounded \${pkg.status === 'active' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}\`}>{pkg.status}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 z-10 relative">
                              <button onClick={() => handleViewAdvPackage(pkg.id)} className="text-indigo-base hover:text-indigo-mid p-2 rounded-lg hover:bg-indigo-soft/50 transition-colors" title="Lihat Detail">
                                <Icon name="Eye" size={16} />
                              </button>
                              <button onClick={() => handleOpenOthersEdit(pkg)} className="text-amber-500 hover:text-amber-600 p-2 rounded-lg hover:bg-amber-50 transition-colors" title="Edit Paket">
                                <Icon name="Pencil" size={16} />
                              </button>
                              <button onClick={() => setOthersDeleteId(pkg.id)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors" title="Hapus">
                                <Icon name="Trash2" size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )})}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        `;

  content = content.substring(0, startIndex) + newUI + content.substring(endIndex);
  
  // also handle "packageMode === 'advance' && " at line 653 for promote button
  content = content.replace(
    /\{activeTab === 'packages' && packageMode === 'advance' && \(/,
    `{activeTab === 'packages' && (`
  );

  fs.writeFileSync(filePath, content);
  console.log('UI update successful!');
} else {
  console.error('Could not find start or end index for packages tab UI');
}

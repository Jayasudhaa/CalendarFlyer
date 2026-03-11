import React, { useState } from 'react';
import { X, Upload, Copy, Check } from 'lucide-react';

const BroadcastPage = ({ onClose }) => {
  const [uploadedMedia, setUploadedMedia] = useState(null);
  const [mediaType, setMediaType] = useState(null);
  const [caption, setCaption] = useState('');
  const [autoIncludeRSVP, setAutoIncludeRSVP] = useState(true);
  const [selectedPlatforms, setSelectedPlatforms] = useState({
    whatsapp: true,
    facebook: false,
    instagram: false
  });
  const [copied, setCopied] = useState(false);

  const rsvpUrl = "https://jyuxa8xvk6.us-east-2.awsapprunner.com/rsvp/event-123";

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedMedia(event.target.result);
      setMediaType(file.type.startsWith('image/') ? 'image' : 'video');
    };
    reader.readAsDataURL(file);
  };

  const removeMedia = () => {
    setUploadedMedia(null);
    setMediaType(null);
  };

  const togglePlatform = (platform) => {
    setSelectedPlatforms(prev => ({
      ...prev,
      [platform]: !prev[platform]
    }));
  };

  const copyLink = () => {
    navigator.clipboard.writeText(rsvpUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuickBroadcast = () => {
    const message = autoIncludeRSVP ? `${caption}\n\n🔗 RSVP: ${rsvpUrl}` : caption;
    
    if (selectedPlatforms.whatsapp) {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
      window.open(waUrl, '_blank');
    }
    
    alert('✅ Quick Broadcast: Opening selected platforms with your content!');
  };

  const handleApiBroadcast = () => {
    alert('⚡ API Broadcast:\n\nThis feature requires one-time API setup for WhatsApp Business, Facebook, and Instagram.\n\nWould you like to configure API credentials?');
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-auto z-50">
      {/* Animated Background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-20 left-20 w-96 h-96 bg-indigo-500 rounded-full filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-500 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-emerald-500 rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="bg-slate-800/80 backdrop-blur-xl border-b border-slate-700/50 sticky top-0 z-20">
          <div className="max-w-7xl mx-auto px-8 py-6 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="text-4xl">📢</div>
              <div>
                <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-400 via-pink-400 to-emerald-400 bg-clip-text text-transparent">
                  Broadcast Studio
                </h1>
                <p className="text-slate-400 text-sm font-medium tracking-wide uppercase mt-1">
                  Multi-Platform Content Distribution
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-red-500/50 transition-all hover:scale-105"
            >
              <X className="w-5 h-5" />
              Close
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column - Controls */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Upload Media */}
              <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">📸</span>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Media Upload</h3>
                </div>
                
                {!uploadedMedia ? (
                  <label className="block border-2 border-dashed border-indigo-500/50 rounded-xl p-12 text-center cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-all group">
                    <Upload className="w-16 h-16 mx-auto mb-4 text-indigo-400 group-hover:scale-110 transition-transform" />
                    <p className="text-white font-semibold text-lg mb-2">Click or drag to upload</p>
                    <p className="text-slate-400 text-sm">Images, Videos • Max 50MB</p>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                ) : (
                  <div className="relative rounded-xl overflow-hidden shadow-2xl">
                    {mediaType === 'image' ? (
                      <img src={uploadedMedia} alt="Upload" className="w-full max-h-96 object-cover" />
                    ) : (
                      <video src={uploadedMedia} controls className="w-full max-h-96 object-cover" />
                    )}
                    <button
                      onClick={removeMedia}
                      className="absolute top-4 right-4 w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-110"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Caption */}
              <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">✍️</span>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Caption & Message</h3>
                </div>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write your broadcast message...

Example:
🙏 Join us for Sri Satyanarayana Swamy Pooja

📅 March 2, 2026 at 10:00 AM
📍 Sri Venkateswara Temple

Your RSVP link will be added automatically!"
                  className="w-full h-40 bg-slate-900/80 border border-slate-600/50 rounded-xl p-4 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50 outline-none resize-none"
                />
                <div className="text-right text-sm text-slate-400 mt-2 font-medium">
                  {caption.length} / 1024
                </div>
              </div>

              {/* RSVP Link */}
              <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🔗</span>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">RSVP Link</h3>
                </div>
                <div className="flex gap-3">
                  <div className="flex-1 bg-slate-900/80 border border-slate-600/50 rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-xl">🔗</span>
                    <input
                      type="text"
                      value={rsvpUrl}
                      readOnly
                      className="flex-1 bg-transparent text-blue-400 font-mono text-sm outline-none"
                    />
                  </div>
                  <button
                    onClick={copyLink}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl font-bold hover:shadow-lg hover:shadow-indigo-500/50 transition-all hover:scale-105 flex items-center gap-2"
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <label className="flex items-center gap-2 mt-4 text-slate-300 cursor-pointer hover:text-white transition-colors">
                  <input
                    type="checkbox"
                    checked={autoIncludeRSVP}
                    onChange={(e) => setAutoIncludeRSVP(e.target.checked)}
                    className="w-5 h-5 accent-indigo-500"
                  />
                  <span className="font-medium">Auto-include in message</span>
                </label>
              </div>

              {/* Platforms */}
              <div className="bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🌐</span>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Select Platforms</h3>
                </div>
                <div className="space-y-3">
                  {[
                    { key: 'whatsapp', icon: '💬', name: 'WhatsApp', desc: 'Temple community group', color: 'from-green-500 to-emerald-500' },
                    { key: 'facebook', icon: '📘', name: 'Facebook', desc: 'Temple page', color: 'from-blue-500 to-blue-600' },
                    { key: 'instagram', icon: '📷', name: 'Instagram', desc: 'Temple stories & posts', color: 'from-pink-500 to-purple-500' }
                  ].map(platform => (
                    <label
                      key={platform.key}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedPlatforms[platform.key]
                          ? 'border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20'
                          : 'border-slate-600/50 bg-slate-900/50 hover:border-slate-500'
                      }`}
                      onClick={() => togglePlatform(platform.key)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPlatforms[platform.key]}
                        onChange={() => {}}
                        className="w-5 h-5 accent-indigo-500"
                      />
                      <span className="text-3xl">{platform.icon}</span>
                      <div className="flex-1">
                        <div className="font-bold text-white">{platform.name}</div>
                        <div className="text-sm text-slate-400">{platform.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column - Preview */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 bg-slate-800/60 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/50 shadow-xl">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-2xl">📱</span>
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Preview</h3>
                </div>

                {/* WhatsApp Preview */}
                <div className="bg-slate-900/80 rounded-xl p-4 mb-4 border border-slate-700/50">
                  <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-700">
                    <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center text-2xl shadow-lg">
                      💬
                    </div>
                    <div>
                      <div className="font-bold text-white">Temple WhatsApp</div>
                      <div className="text-xs text-slate-400">Community Group</div>
                    </div>
                  </div>
                  
                  {uploadedMedia && (
                    <div className="rounded-lg overflow-hidden mb-3 shadow-lg">
                      {mediaType === 'image' ? (
                        <img src={uploadedMedia} alt="Preview" className="w-full max-h-48 object-cover" />
                      ) : (
                        <video src={uploadedMedia} className="w-full max-h-48 object-cover" />
                      )}
                    </div>
                  )}
                  
                  <div className="text-slate-200 text-sm whitespace-pre-wrap mb-3">
                    {caption || 'Your message will appear here...'}
                  </div>
                  
                  {autoIncludeRSVP && caption && (
                    <div className="bg-indigo-500/20 border border-indigo-500/50 rounded-lg p-3 text-sm">
                      <div className="text-blue-400 font-mono break-all">
                        🔗 RSVP: {rsvpUrl}
                      </div>
                    </div>
                  )}
                </div>

                {/* Broadcast Buttons */}
                <div className="space-y-3 mt-6">
                  <button
                    onClick={handleQuickBroadcast}
                    className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-bold text-lg shadow-lg shadow-green-500/50 hover:shadow-xl hover:shadow-green-500/60 transition-all hover:scale-105 flex items-center justify-center gap-3"
                  >
                    <span className="text-2xl">🚀</span>
                    Quick Broadcast
                  </button>
                  <p className="text-center text-xs text-slate-400">Opens apps with content ready</p>
                  
                  <div className="relative text-center text-slate-500 text-sm font-semibold my-4">
                    <span className="bg-slate-800 px-3 relative z-10">OR</span>
                    <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-700"></div>
                  </div>
                  
                  <button
                    onClick={handleApiBroadcast}
                    className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/60 transition-all hover:scale-105 flex items-center justify-center gap-3"
                  >
                    <span className="text-2xl">⚡</span>
                    API Auto-Post
                  </button>
                  <p className="text-center text-xs text-slate-400">Automatic posting (setup required)</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default BroadcastPage;

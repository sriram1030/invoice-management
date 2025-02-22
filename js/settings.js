import { supabase } from './config.js';

export function setupSettings() {
    console.log('Setting up settings...');
    const settingsForm = document.getElementById('settingsForm');
    if (settingsForm) {
        settingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Submitting settings form...');
            try {
                const fileInput = document.getElementById('logoUpload');
                const file = fileInput.files[0];
                if (file) {
                    const { data, error } = await supabase
                        .storage
                        .from('logos')
                        .upload('logo.png', file, { upsert: true });
                    if (error) {
                        console.error('Error uploading logo:', error);
                        throw error;
                    }
                    const logoUrl = supabase.storage.from('logos').getPublicUrl(data.path).data.publicUrl;
                    await supabase.from('settings').update({ logo_path: logoUrl }).eq('id', 1);
                    document.querySelector('.logo').src = logoUrl;
                    $('#settingsModal').modal('hide');
                }
            } catch (error) {
                console.error('Failed to upload logo:', error);
                alert('Failed to upload logo: ' + (error.message || 'Unknown error'));
            }
        });
    }
}
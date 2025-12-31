// ticket/logSearch.js
// Logging system for searching ticket logs by Discord username
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const TICKET_LOGS_DB = require('./ticketLogsDb'); // Placeholder for ticket logs storage

const LOG_CHANNEL_ID = '1455939119325642772';

async function postLogSearchEmbed(client) {
    const channel = await client.channels.fetch(LOG_CHANNEL_ID).catch(() => null);
    if (!channel) return;
    const embed = new EmbedBuilder()
        .setTitle('Ticket Log Search')
        .setDescription('Click the button below to search ticket logs by Discord username.')
        .setColor(0x5865F2);
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('log_search_button')
            .setLabel('Search Ticket Logs')
            .setStyle(ButtonStyle.Primary)
    );
    await channel.send({ embeds: [embed], components: [row] });
}

async function handleLogSearchButton(interaction) {
    const modal = new ModalBuilder()
        .setCustomId('log_search_modal')
        .setTitle('Search Ticket Logs');
    const usernameInput = new TextInputBuilder()
        .setCustomId('log_search_username')
        .setLabel('Discord Username (case-sensitive)')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    modal.addComponents(new ActionRowBuilder().addComponents(usernameInput));
    await interaction.showModal(modal);
}

async function handleLogSearchModal(interaction, client) {
    const username = interaction.fields.getTextInputValue('log_search_username');
    // Fetch all ticket logs for this username
    const logs = await TICKET_LOGS_DB.getLogsByUsername(username, client);
    if (!logs || logs.length === 0) {
        await interaction.reply({ content: `No ticket logs found for **${username}**.`, ephemeral: true });
        return;
    }
    // Send each log as its own embed
    for (const log of logs) {
        const embed = new EmbedBuilder()
            .setTitle(`Ticket Log: #${log.channelName}`)
            .setDescription(log.messages.map(m => `**${m.author}:** ${m.content}`).join('\n'))
            .setColor(0x5865F2)
            .setFooter({ text: `Ticket ID: ${log.channelId}` });
        await interaction.user.send({ embeds: [embed] });
    }
    await interaction.reply({ content: `Sent ${logs.length} ticket log(s) for **${username}** to your DMs.`, ephemeral: true });
}

module.exports = {
    postLogSearchEmbed,
    handleLogSearchButton,
    handleLogSearchModal,
};

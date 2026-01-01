// (moved) Welcome new members handler placed after client initialization
// index.js
// Discord bot entry point
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, Events } = require('discord.js');
const { deploycommands } = require('./deploy-commands');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

// In-memory session vote tracking: channelId -> { messageId, voters:Set, voterOrder:[], completed }
const sessionVotes = new Map();
const SESSION_ROLE_ID = '1429990114678935594';

// Welcome new members with info and membercount buttons
client.on('guildMemberAdd', async member => {
    try {
        const channel = await member.guild.channels.fetch('1429990116553658429').catch(() => null);
        if (!channel || !channel.isTextBased()) return;
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
        const infoButton = new ButtonBuilder()
            .setLabel('Information')
            .setStyle(ButtonStyle.Link)
            .setURL('https://discord.com/channels/1429990114255310849/1455927265207779370');
    const memberCountButton = new ButtonBuilder()
        .setLabel(`${member.guild.memberCount}`)
        .setStyle(ButtonStyle.Secondary)
        .setCustomId('membercount_disabled')
        .setDisabled(true);
    const row = new ActionRowBuilder().addComponents(infoButton, memberCountButton);
    await channel.send({
        content: `Welcome <@${member.id}> to Los Angeles State Roleplay! We hope you enjoy your stay!`,
        components: [row]
    });
    } catch (err) {
        console.error('Error in guildMemberAdd handler:', err);
    }
});

const { postTicketEmbed, handleCategorySelect, handleClaim, handleClose, handleActionSelect, TICKET_CATEGORIES } = require('./ticket/ticketManager');
const { handleRename, handleAddUser } = require('./ticket/commands');
const { data: slashCommands } = require('./ticket/registerCommands');
const { runErlcCommand, getErlcPlayers } = require('./erlc');
const { postLogSearchEmbed, handleLogSearchButton, handleLogSearchModal } = require('./ticket/logSearch');

// Set bot status to ERLC players, then to 'loading' after 5 seconds
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}`);
    try {
        const playerCount = await getErlcPlayers();
        await client.user.setActivity(`Erlc Players: ${playerCount}`, { type: 0 });

        // Post ERLC status embed to status channel (includes server info and staff-online)
        (async () => {
            try {
                const statusChannel = await client.channels.fetch('1429990116331491421').catch(() => null);
                if (!statusChannel || !statusChannel.isTextBased()) return;
                const { EmbedBuilder } = require('discord.js');
                const guild = statusChannel.guild;
                const serverCode = guild?.id ?? 'unknown';
                const serverName = guild?.name ?? 'unknown';
                let ownerTag = 'unknown';
                try {
                    const owner = await guild.fetchOwner();
                    ownerTag = owner?.user ? `${owner.user.tag}` : ownerTag;
                } catch (e) {
                    // ignore
                }

                // Determine staff roles from ticket categories and count online staff
                const staffRoleIds = Object.values(TICKET_CATEGORIES || {}).map(c => c.staffRole).filter(Boolean);
                let staffOnline = 'unknown';
                try {
                    await guild.members.fetch(); // populate cache
                    const members = guild.members.cache;
                    const staffMembers = members.filter(m => staffRoleIds.some(rid => m.roles.cache.has(rid)));
                    // If presence data is available, count those not offline
                    const onlineCount = staffMembers.filter(m => m.presence && m.presence.status !== 'offline').size;
                    if (staffMembers.size === 0) staffOnline = '0';
                    else if (onlineCount > 0) staffOnline = `${onlineCount}/${staffMembers.size}`;
                    else {
                        // presence may be unavailable due to intents; fall back to total staff count
                        staffOnline = `${staffMembers.size} (presence unavailable)`;
                    }
                } catch (e) {
                    staffOnline = 'unknown';
                }
                const bannerembed = new EmbedBuilder()
                .setImage('https://media.discordapp.net/attachments/1455024557730562174/1456307605302415517/larp-dc-banner.png?ex=6957e3a5&is=69569225&hm=73eb30ea29c417a888c7a4a66cc5d2258c756980082abcf9fb82c5090aaac370&=&format=webp&quality=lossless')
                .setColor(0x5763d1);
                const statusEmbed = new EmbedBuilder()
                    .setTitle('ERLC Server Status')
                    .setDescription('Hello, welcome to sessions! Here you can find the current server status and information.')
                    .setImage('https://media.discordapp.net/attachments/1455024557730562174/1456297683726766210/image.png?ex=6957da68&is=695688e8&hm=dfc0ce9d7e021dfc663e907f451644e76cbc6ccb71ab81137713563c54064ca1&=&format=webp&quality=lossless')
                    .addFields(
                        { name: 'Players', value: String(playerCount), inline: false },
                        { name: 'Server Code', value: String(serverCode), inline: false },
                        { name: 'Server Name', value: String(serverName), inline: false },
                        { name: 'Owner', value: 'Eddie', inline: false },
                        { name: 'Staff Online', value: String(staffOnline), inline: false },
                    )
                    .setColor(0x5763d1)
                    .setTimestamp();
                await statusChannel.send({ embeds: [bannerembed, statusEmbed] });
            } catch (err) {
                console.error('Failed to send ERLC status embed:', err);
            }
        })();
    } catch (e) {
        await client.user.setActivity('Erlc Players: error', { type: 0 });
    }
    setTimeout(() => {
        client.user.setActivity('Loading', { type: 0 });
    }, 5000);
    // Post ticket embed on ready
    await postTicketEmbed(client);

    // Post log search embed in logging channel
    await postLogSearchEmbed(client);

    // Post rules embed with dropdown to channel 1429990115974840466
    const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
    const rulesChannel = await client.channels.fetch('1429990115974840466').catch(() => null);
    if (rulesChannel && rulesChannel.isTextBased()) {
        const bannerembed = new EmbedBuilder()
            .setColor(0x5763d1)
            .setImage('https://media.discordapp.net/attachments/1455024557730562174/1456135469451444358/6.png?ex=69574355&is=6955f1d5&hm=7bc5c021080ecb0eb0ea534434fdcc6d947d70d1d62c448d85a93619de6b5a15&=&format=webp&quality=lossless');
        const rulesEmbed = new EmbedBuilder()
            .setTitle('Regulations')
            .setDescription('Hello, welcome to our regulations section. Please select from the dropdown menu below to view either our Discord server rules or our in-game rules.')
            .setFields(
                { name: 'New Coming Soon', value: 'We are planning to have a new regulations (FAQ) by the end of this week, please use this until further notice.' }
            )
            .setColor(0x5763d1)
            .setImage('https://media.discordapp.net/attachments/1455024557730562174/1456297683726766210/image.png?ex=6957da68&is=695688e8&hm=dfc0ce9d7e021dfc663e907f451644e76cbc6ccb71ab81137713563c54064ca1&=&format=webp&quality=lossless');
        const rulesSelect = new StringSelectMenuBuilder()
            .setCustomId('rules_select')
            .setPlaceholder('Select rules to view...')
            .addOptions([
                {
                    label: 'Discord Rules',
                    value: 'discord_rules',
                    description: 'View Discord server rules',
                    emoji: { id: '1455937378442285077' }
                },
                {
                    label: 'In-Game Rules',
                    value: 'ingame_rules',
                    description: 'View in-game rules',
                    emoji: { id: '1455937954445791232' }
                },
            ]);
        const rulesRow = new ActionRowBuilder().addComponents(rulesSelect);
        await rulesChannel.send({ embeds: [bannerembed, rulesEmbed], components: [rulesRow] });
    }

    // Send image embed and Information embed to channel 1455034556104052901
    const channel = await client.channels.fetch('1455927265207779370');
    if (channel && channel.isTextBased()) {
        // Send both embeds in one message
        const imageEmbed = {
            color: 0x5763d1,
            image: {
                url: 'https://media.discordapp.net/attachments/1455024557730562174/1456135471720693864/1.png?ex=69574356&is=6955f1d6&hm=58477ef4c448636bdbfbfb16ded4ffddcc785f2626b92cfbf13e52426ddf9a2d&=&format=webp&quality=lossless'
            }
        };
        const infoEmbed = {
            color: 0x5763d1,
            title: 'Information',
            description: 'Welcome to Los Angeles State Roleplay\'s Dashboard Channel! Below is everything you need',
            fields: [
                {
                    name: '<:larp:1456286965048545473> Important Links:',
                    value: '\n- **Roblox Group** - Coming Soon\n- **Moderation Application** - **[Click Me](https://docs.google.com/forms/d/e/1FAIpQLSezVNksME3fGnGxXsDjOmW3FdepuX0aYqZmaPfuyjbMydAyXQ/viewform?usp=dialog)**\n- **Bot Updates**\n`Changed to Los Angeles State Roleplay Assets`',
                    inline: false
                },
                {
                    name: 'Important Channels',
                    value: '\n<#1429990115974840466>\n<#1429990116331491421>\n<#1429990115974840467>',
                    inline: false
                }
            ],
            image: {
                url: 'https://media.discordapp.net/attachments/1455024557730562174/1456297683726766210/image.png?ex=6957da68&is=695688e8&hm=dfc0ce9d7e021dfc663e907f451644e76cbc6ccb71ab81137713563c54064ca1&=&format=webp&quality=lossless'
            },
            footer: {
                text: '© Copyrighted Material',
                iconURL: 'https://media.discordapp.net/attachments/1429990115974840461/1456287935430394000/IMG_0799-removebg-preview.png?ex=6957d154&is=69567fd4&hm=95a64f2045990bc0563d0b74fb0b27a4e2a6dcfa1df0663ef411c2e92cfef4f3&=&format=webp&quality=lossless'
            },
            author: {
                name: 'Los Angeles State Roleplay',
                iconURL: 'https://media.discordapp.net/attachments/1429990115974840461/1456287935430394000/IMG_0799-removebg-preview.png?ex=6957d154&is=69567fd4&hm=95a64f2045990bc0563d0b74fb0b27a4e2a6dcfa1df0663ef411c2e92cfef4f3&=&format=webp&quality=lossless'
            }
        };
        await channel.send({ embeds: [imageEmbed, infoEmbed] });
        await channel.send({ embeds: [imageEmbed, infoEmbed] });
    }
    // Register slash commands for tickets
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
    try {
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: slashCommands }
        );
        console.log('Ticket slash commands registered.');
    } catch (err) {
        console.error('Failed to register ticket slash commands:', err);
    }
});

client.on('interactionCreate', async interaction => {
    try {
        // Ticket dropdown for category
        if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_category') {
            return handleCategorySelect(interaction);
        }
    // Ticket dropdown for actions
    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_action') {
        return handleActionSelect(interaction);
    }
    // Log search button
    if (interaction.isButton() && interaction.customId === 'log_search_button') {
        return handleLogSearchButton(interaction);
    }
    // Log search modal
    if (interaction.isModalSubmit && interaction.customId === 'log_search_modal') {
        return handleLogSearchModal(interaction, client);
    }
        // Rules dropdown
        if (interaction.isStringSelectMenu() && interaction.customId === 'rules_select') {
            let embed;
            if (interaction.values[0] === 'discord_rules') {
            embed = {
                color: 0x5763d1,
                title: 'Discord Server Rules',
                image: {
                    url: 'https://media.discordapp.net/attachments/1455024557730562174/1456135471183954082/2.png?ex=69574356&is=6955f1d6&hm=5a88570702d40e34deaf256fc4a4a60503b257fd2d51aa84b8a2493a3487c83b&=&format=webp&quality=lossless'
                },
                description: [
                    '`1` Swearing\nWhilst we allow swearing, constant use of profanities especially in unneeded situations will result in moderation. The use of any vulgar profanity will also result in moderation.',
                    '`2` Mentions\nMentioning users repeatedly or unnecessarily will result in moderation. Mentioning VIP\'s or Management+ for no reason will also not be tolerated. To turn off mention upon reply click \'@mention\' button.',
                    '`3` Not Safe For Work\nNot Safe For Work (NSFW) content or language will not be tolerated and will result in a ban.',
                    '`4` Self Advertising\nAdvertising your own server in people\'s DMs or in channels will not be tolerated and can result in a ban.',
                    '`5` Language\nThis is a Australian based server, so the required language all members are expected to speak is English.',
                    '`6` Spamming\nSpamming messages, images, or reactions will not be tolerated and will result in moderation.',
                    '`7` Discrimination & Hate Speech\nAny form of discrimination or hate speech towards any individual or group will not be tolerated and will result in a ban.',
                    '`8` Personal Information\nSharing personal information of yourself or others will not be tolerated and will result in a ban.',
                    '`9` Impersonation\nImpersonating staff members or other users will not be tolerated and will result in moderation.',
                    '`10` Following Discord TOS\nAll members must adhere to Discord\'s Terms of Service at all times while on this server.',
                    '`11` Following Staff Instructions\nAll members must follow the instructions given by staff members. Failure to do so may result in moderation.',
                    '`12` Appeals\nIf you wish to appeal a moderation action, please contact a member of Management+ our support system.',
                ].join('\n'),
            };
        } else if (interaction.values[0] === 'ingame_rules') {
            embed = {
                color: 0x5763d1,
                title: 'In-Game Rules',
                image: {
                    url: 'https://media.discordapp.net/attachments/1455024557730562174/1456135470789558353/3.png?ex=69574355&is=6955f1d5&hm=0b2ccffe37bcdb4125b5b894a79b73c165ee0fafbb93eeb05c69e694b0700d3a&=&format=webp&quality=lossless'
                },
                description: [
                    '`1` No exploiting or cheating.',
                    '`2` Respect all players and staff.',
                    '`3` No griefing or trolling.',
                    '`4` Follow all roleplay guidelines.',
                    '`5` Listen to staff instructions.',
                    '`6` No offensive language or behavior.',
                    '`7` No spamming or advertising.',
                    '`8` Use appropriate character names.',
                    '`9` Realistic Avatars only.',
                    '`10` Report rule violations to staff.',
                ].join('\n'),
            };
        }
            if (embed) {
                await interaction.reply({ embeds: [embed], ephemeral: true });
            } else {
                await interaction.reply({ content: 'Unknown rules category.', ephemeral: true });
            }
            return;
        }
        // end rules_select
        
        // Ticket claim/close buttons
    // Button interactions
    if (interaction.isButton()) {
        // Ticket claim/close
        if (interaction.customId === 'ticket_claim') return handleClaim(interaction);

        // Session vote button: customId format 'session_vote:<channelId>'
        if (interaction.customId && interaction.customId.startsWith('session_vote:')) {
            try {
                const channelId = interaction.customId.split(':')[1];
                const session = sessionVotes.get(channelId);
                if (!session || session.completed) {
                    return interaction.reply({ content: 'This session vote is no longer active.', ephemeral: true });
                }
                const userId = interaction.user.id;
                if (session.voters.has(userId)) {
                    return interaction.reply({ content: 'You have already voted.', ephemeral: true });
                }
                session.voters.add(userId);
                session.voterOrder.push(userId);

                // Update vote button label and edit original message
                const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
                const votesCount = session.voters.size;
                const button = new ButtonBuilder()
                    .setCustomId(interaction.customId)
                    .setLabel(`Vote (${votesCount})`)
                    .setStyle(ButtonStyle.Primary);
                if (session.completed) button.setDisabled(true);
                const row = new ActionRowBuilder().addComponents(button);

                // Try to update original message; fall back to acknowledge
                try {
                    const msg = await interaction.channel.messages.fetch(session.messageId).catch(() => null);
                    if (msg) await msg.edit({ components: [row] });
                    await interaction.deferUpdate();
                } catch (e) {
                    await interaction.reply({ content: `Vote recorded (${votesCount}).`, ephemeral: true });
                }

                // When threshold reached, send notification and disable button
                if (votesCount >= 5 && !session.completed) {
                    session.completed = true;
                    try {
                        const mentions = session.voterOrder.slice(0, 5).map(id => `<@${id}>`).join(' ');
                        const bannerembed = new EmbedBuilder()
                            .setColor(0x5763d1)
                            .setImage('https://media.discordapp.net/attachments/1455024557730562174/1456307605302415517/larp-dc-banner.png?ex=6957e3a5&is=69569225&hm=73eb30ea29c417a888c7a4a66cc5d2258c756980082abcf9fb82c5090aaac370&=&format=webp&quality=lossless');
                         await interaction.channel.send({ embeds: [bannerembed] });
                        const reachedEmbed = new EmbedBuilder()
                            .setTitle('Session Started')
                            .setDescription(`The session has reached the required number of votes (${votesCount}) and will be starting soon! Please be patient as our staff get online to moderate.`)
                            .addFields({ name: 'Voters', value: mentions })
                            .setColor(0x5763d1)
                            .setImage('https://media.discordapp.net/attachments/1455024557730562174/1456297683726766210/image.png?ex=6957da68&is=695688e8&hm=dfc0ce9d7e021dfc663e907f451644e76cbc6ccb71ab81137713563c54064ca1&=&format=webp&quality=lossless')
                            .setTimestamp();
                        await interaction.channel.send({ content: '@everyone', mentions, embeds: [reachedEmbed] });
                        // disable button visually
                        const disabledButton = new ButtonBuilder()
                            .setCustomId(interaction.customId)
                            .setLabel(`Vote (${votesCount})`)
                            .setStyle(ButtonStyle.Secondary)
                            .setDisabled(true);
                        const disabledRow = new ActionRowBuilder().addComponents(disabledButton);
                        const msg = await interaction.channel.messages.fetch(session.messageId).catch(() => null);
                        if (msg) await msg.edit({ components: [disabledRow] });
                    } catch (err) {
                        console.error('Error sending session reached embed:', err);
                    }
                }
            } catch (err) {
                console.error('Error handling session vote button:', err);
                try { await interaction.reply({ content: 'Error recording vote.', ephemeral: true }); } catch(_){}
            }
            return;
        }
    }
    // /add-user slash command
    if (interaction.isChatInputCommand() && interaction.commandName === 'add-user') {
        return handleAddUser(interaction);
    }
    // Existing ERLC command
    if (interaction.isChatInputCommand() && interaction.commandName === 'erlc') {
        const commandText = interaction.options.getString('text');
        await interaction.deferReply({ ephemeral: true });
        try {
            await runErlcCommand(commandText);
            await interaction.editReply({ content: '✅ Successfully executed', ephemeral: true });
        } catch (err) {
            await interaction.editReply({ content: `❌ Error: ${err.message}`, ephemeral: true });
        }
    }
    } catch (err) {
        console.error('Error handling interactionCreate:', err);
        try {
            if (interaction && typeof interaction.reply === 'function' && !interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'An error occurred while processing this interaction.', ephemeral: true });
            }
        } catch (e) {
            // ignore reply errors (interaction may be expired)
        }
    }
});

// Prevent process crash when the client emits an 'error' event
client.on('error', (err) => {
    console.error('Discord client error event:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

// !rename command for tickets
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!rename ')) return;
    const args = message.content.slice('!rename '.length).trim().split(/ +/);
    await handleRename(message, args);
});

// Session commands: -sessionvote and -sessionend
client.on('messageCreate', async message => {
    if (message.author.bot) return;
    const content = message.content.trim();
    const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

    // Start a session vote in this channel
    if (content === '-sessionvote') {
        // Only allow users with the session role
        const member = message.member;
        if (!member || !member.roles.cache.has(SESSION_ROLE_ID)) {
            await message.reply('You do not have permission to start a session vote.');
            return;
        }
        // Prevent multiple sessions in the same channel
        if (sessionVotes.has(message.channel.id) && !sessionVotes.get(message.channel.id).completed) {
            await message.reply('A session vote is already active in this channel.');
            return;
        }
        const button = new ButtonBuilder()
            .setCustomId(`session_vote:${message.channel.id}`)
            .setLabel('Vote (0)')
            .setStyle(ButtonStyle.Secondary);
        const row = new ActionRowBuilder().addComponents(button);
        const bannerembed = new EmbedBuilder()
            .setColor(0x5763d1)
            .setImage('https://media.discordapp.net/attachments/1455024557730562174/1456307605302415517/larp-dc-banner.png?ex=6957e3a5&is=69569225&hm=73eb30ea29c417a888c7a4a66cc5d2258c756980082abcf9fb82c5090aaac370&=&format=webp&quality=lossless');
        const embed = new EmbedBuilder()
            .setTitle('Session Vote')
            .setDescription(`${message.author.tag} has started a session vote. Click the button to join the vote.`)
            .setColor(0x5763d1)
            .setImage('https://media.discordapp.net/attachments/1455024557730562174/1456297683726766210/image.png?ex=6957da68&is=695688e8&hm=dfc0ce9d7e021dfc663e907f451644e76cbc6ccb71ab81137713563c54064ca1&=&format=webp&quality=lossless')
            .setTimestamp();
        const sent = await message.channel.send({ content: '@everyone', embeds: [bannerembed, embed], components: [row] });
        sessionVotes.set(message.channel.id, { messageId: sent.id, voters: new Set(), voterOrder: [], completed: false });
        return;
    }

    // End the session and clean the channel (role-restricted)
    if (content === '-sessionend') {
        // Only allow users with the session role
        const member = message.member;
        if (!member || !member.roles.cache.has(SESSION_ROLE_ID)) {
            await message.reply('You do not have permission to end the session.');
            return;
        }
        const channel = message.channel;
        // Fetch all messages in the channel
        let all = [];
        try {
            let lastId;
            while (true) {
                const fetched = await channel.messages.fetch({ limit: 100, before: lastId });
                if (fetched.size === 0) break;
                all = all.concat(Array.from(fetched.values()));
                lastId = fetched.last()?.id;
                if (fetched.size < 100) break;
            }
        } catch (e) {
            // ignore
        }
        // include any recently cached messages (ensure we have the latest)
        try {
            const recent = await channel.messages.fetch({ limit: 100 });
            all = all.concat(Array.from(recent.values()));
        } catch (e) {}
        // Remove duplicates and sort by createdTimestamp
        const uniq = Array.from(new Map(all.map(m => [m.id, m])).values()).sort((a,b) => a.createdTimestamp - b.createdTimestamp);
        if (uniq.length <= 1) {
            await message.channel.send('Nothing to clean.');
            return;
        }
        // Keep the first (oldest) message, delete the rest
        const toDelete = uniq.slice(1);
        for (const msg of toDelete) {
            try {
                await msg.delete().catch(() => null);
            } catch (e) {}
        }
        // Clear any session tracking for this channel
        sessionVotes.delete(channel.id);
         const bannerembed = new EmbedBuilder()
            .setColor(0x5763d1)
            .setImage('https://media.discordapp.net/attachments/1455024557730562174/1456307605302415517/larp-dc-banner.png?ex=6957e3a5&is=69569225&hm=73eb30ea29c417a888c7a4a66cc5d2258c756980082abcf9fb82c5090aaac370&=&format=webp&quality=lossless');
        const endEmbed = new EmbedBuilder()
            .setTitle('Session Ended')
            .setDescription(`${message.author.tag} ended the session and we hope you can join us for the second session!`)
            .setColor(0x5763d1)
            .setTimestamp();
        await channel.send({ embeds: [bannerembed, endEmbed] });
        return;
    }
});

client.login(process.env.BOT_TOKEN);